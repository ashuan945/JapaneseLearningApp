using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace JapaneseLearningApp.Data
{
    // Create Database Context
    public class AppDbContext: DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) :
            base(options) { }

        // add to DbContext
        public DbSet<Vocabulary> Vocabulary { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserProgress> UserProgress { get; set; }
        public DbSet<VocabularyAi> VocabularyAi { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<VocabularyAi>()
                .HasOne(v => v.Vocabulary)
                .WithMany()
                .HasForeignKey(v => v.VocabularyId);
        }

    }




}
