using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authorization;

namespace JapaneseLearningAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        public UsersController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ==========================================
        // Helper: Get UserId from JWT Token
        // ==========================================
        private int GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");
            if (claim == null)
                throw new Exception("UserId not found in token");

            return int.Parse(claim.Value);
        }


        // =========================================================
        // REGISTER
        // POST: /api/users/register
        // =========================================================
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            // Check empty fields
            if (string.IsNullOrWhiteSpace(request.Username) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("All fields are required.");
            }

            // Email format validation
            var emailRegex = new System.Text.RegularExpressions.Regex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$");
            if (!emailRegex.IsMatch(request.Email))
            {
                return BadRequest("Invalid email format.");
            }

            // Password length validation
            if (request.Password.Length < 6)
            {
                return BadRequest("Password must be at least 6 characters.");
            }

            // Existing user check
            var existingUsername = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username);

            // Check if email already registered
            var existingEmail = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email || u.Username == request.Username);

            if (existingUsername != null)
                return BadRequest("Username already existed! Please try another.");
            if (existingEmail != null)
                return BadRequest("Email already registered!");

            // Create new user
            var user = new User
            {
                Username = request.Username,
                Password = request.Password,
                Email = request.Email,
                ProfileImage = "/images/default-avatar.png"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok("User registered successfully");
        }


        // =========================================================
        // LOGIN
        // POST: /api/users/login
        // =========================================================
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            // Validate user credentials
            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.Username == request.Username &&
                    u.Password == request.Password);

            if (user == null)
                return Unauthorized("Invalid username or password");

            // Create JWT claims
            var claims = new[]
            {
                new Claim("userId", user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Email, user.Email)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var expiry = DateTime.UtcNow.AddMinutes(30);

            // Generate token
            var token = new JwtSecurityToken(
                claims: claims,
                expires: expiry,
                signingCredentials: creds
            );
            var jwt = new JwtSecurityTokenHandler().WriteToken(token);

            // Store token in HttpOnly cookie
            Response.Cookies.Append("auth_token", jwt, new CookieOptions
            {
                HttpOnly = true,
                Secure = false,        // set true in production (requires HTTPS)
                SameSite = SameSiteMode.Strict,
                Expires = expiry
            });

            return Ok(new
            {
                message = "Login successful",
                token = jwt,
                username = user.Username,
                email = user.Email,
                profileImage = user.ProfileImage
            });
        }


        // =========================================================
        // REFRESH TOKEN
        // POST: /api/users/refresh
        // =========================================================
        [HttpPost("refresh")]
        public IActionResult Refresh()
        {
            // Read token from cookie
            if (!Request.Cookies.TryGetValue("auth_token", out var oldToken))
                return Unauthorized("No token found");

            // Validate the old token
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var handler = new JwtSecurityTokenHandler();

            try
            {
                // Validate existing token
                handler.ValidateToken(oldToken, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out var validated);

                var jwt = (JwtSecurityToken)validated;

                // Re-issue a fresh token with the same claims
                var claims = jwt.Claims
                    .Where(c => c.Type == "userId"
                             || c.Type == ClaimTypes.Name
                             || c.Type == ClaimTypes.Email)
                    .ToArray();

                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var expiry = DateTime.UtcNow.AddMinutes(30);

                // Generate new token
                var newToken = new JwtSecurityToken(
                    claims: claims,
                    expires: expiry,
                    signingCredentials: creds
                );
                var newJwt = handler.WriteToken(newToken);

                // Update cookie
                Response.Cookies.Append("auth_token", newJwt, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = false,
                    SameSite = SameSiteMode.Strict,
                    Expires = expiry
                });

                return Ok(new { token = newJwt });
            }
            catch
            {
                return Unauthorized("Token expired or invalid");
            }
        }


        // =========================================================
        // GET CURRENT USER
        // GET: /api/users/me
        // =========================================================
        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userId = GetUserIdFromToken();

            var user = await _context.Users.FindAsync(userId);

            if (user == null)
                return NotFound();

            return Ok(new
            {
                user.Id,
                user.Username,
                user.Email,
                user.ProfileImage
            });
        }

        // =========================================================
        // UPDATE PROFILE
        // PUT: /api/users/me
        // =========================================================
        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile(ProfileDto updated)
        {
            var userId = GetUserIdFromToken();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // Check duplicate username
            var usernameExists = await _context.Users
                .AnyAsync(u => u.Username == updated.Username && u.Id != userId);

            if (usernameExists)
                return BadRequest("Username already in use");

            // Check duplicate email
            var emailExists = await _context.Users
                .AnyAsync(u => u.Email == updated.Email && u.Id != userId);

            if (emailExists)
                return BadRequest("Email already in use");

            // Update fields
            user.Username = updated.Username;
            user.Email = updated.Email;

            if (!string.IsNullOrEmpty(updated.Password))
            {
                user.Password = updated.Password;
            }

            await _context.SaveChangesAsync();
            return Ok("Profile updated");
        }


        // =========================================================
        // UPLOAD PROFILE IMAGE
        // POST: /api/users/me/upload-image
        // =========================================================
        [Authorize]
        [HttpPost("me/upload-image")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            var userId = GetUserIdFromToken();

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found");

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/images");
            if (!Directory.Exists(folderPath))
                Directory.CreateDirectory(folderPath);

            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(folderPath, fileName);

            // Delete old image if not default
            if (user.ProfileImage != "/images/default-avatar.png")
            {
                var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", user.ProfileImage.TrimStart('/'));

                if (System.IO.File.Exists(oldPath))
                    System.IO.File.Delete(oldPath);
            }

            // Save new file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            user.ProfileImage = "/images/" + fileName;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Profile image updated",
                imageUrl = user.ProfileImage
            });
        }


        // =========================================================
        // DELETE ACCOUNT
        // DELETE: /api/users/me
        // =========================================================
        [Authorize]
        [HttpDelete("me")]
        public async Task<IActionResult> DeleteAccount()
        {
            var userId = GetUserIdFromToken();

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found");

            // Delete related progress
            var progresses = _context.UserProgress.Where(up => up.UserId == userId);
            _context.UserProgress.RemoveRange(progresses);

            // Delete profile image if not default
            if (user.ProfileImage != "/images/default-avatar.png")
            {
                var path = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "wwwroot",
                    user.ProfileImage.TrimStart('/')
                );

                if (System.IO.File.Exists(path))
                    System.IO.File.Delete(path);
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Account deleted successfully" });
        }


        // =========================================================
        // LOGOUT
        // POST: /api/users/logout
        // =========================================================
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("auth_token");
            return Ok(new { message = "Logged out" });
        }
    }
}
