# 日本語 — Japanese Learning App

A full-stack web application for learning Japanese vocabulary, built with **ASP.NET Core** (Razor Pages + Web API) and **SQL Server**. Features flashcards, quizzes, a progress dashboard, and AI-powered word explanations via the Gemini API.



## Features

- **Vocabulary List** — Browse JLPT-levelled vocabulary (N5–N1) with search, level filters, and status tracking (New / Flagged / Learned)
- **Flashcards** — Flip-card study mode with progress tracking, flagging, and Japanese text-to-speech audio
- **Quiz** — Multiple-choice quizzes with real-time scoring, progress bar, and answer feedback
- **Dashboard** — Visual stats (donut + bar charts) showing correct/wrong answers and accuracy by JLPT level
- **AI Explanations** — On-demand word breakdowns and example sentences powered by Google Gemini (cached in database)
- **User Accounts** — Register, login, profile editing, avatar upload with crop tool, and account deletion
- **Guest Mode** — Browse vocabulary and flashcards without logging in (progress not saved)



## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 10 (Razor Pages + Web API) |
| Database | SQL Server + Entity Framework Core |
| Auth | JWT Bearer tokens (HttpOnly cookies) |
| AI | Google Gemini API |
| Frontend | Vanilla JS, Chart.js, Cropper.js |
| Speech | Web Speech API |





## Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- SQL Server with [SSMS](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms) (for database setup)
- Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/your-username/JapaneseLearningApp.git
cd JapaneseLearningApp
```

### 2. Configure app settings

Create or update `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=YOUR_SERVER;Database=JapaneseLearningDB;Trusted_Connection=True;"
  },
  "Jwt": {
    "Key": "your-secret-key-at-least-32-chars-long"
  },
  "Gemini": {
    "ApiKey": "your-gemini-api-key"
  },
  "ApiBaseUrl": "https://localhost:7000"
}
```

> **Never commit real secrets.** Use [User Secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets) or environment variables in production.

### 3. Set up the database

**a)** Create a new database (e.g. `JapaneseLearningDB`) in SSMS, then run the following scripts in order:

```sql
-- Vocabulary (seed this table with your word list)
CREATE TABLE [dbo].[Vocabulary] (
    [Id]           INT            NOT NULL,
    [JapaneseWord] NVARCHAR (50)  NOT NULL,
    [Hiragana]     NVARCHAR (50)  NULL,
    [Meaning]      NVARCHAR (MAX) NOT NULL,
    [Level]        NVARCHAR (50)  NOT NULL,
    CONSTRAINT [PK_vocabulary] PRIMARY KEY CLUSTERED ([Id] ASC)
);
GO
CREATE NONCLUSTERED INDEX [IX_Vocabulary_Level_JapaneseWord]
    ON [dbo].[Vocabulary]([Level] DESC, [JapaneseWord] ASC)
    INCLUDE([Id], [Hiragana], [Meaning]);
GO
CREATE NONCLUSTERED INDEX [IX_Vocabulary_Level_Id]
    ON [dbo].[Vocabulary]([Level] ASC)
    INCLUDE([Id]);

-- VocabularyAi (AI explanation cache)
CREATE TABLE [dbo].[VocabularyAi] (
    [Id]           INT            IDENTITY (1, 1) NOT NULL,
    [VocabularyId] INT            NOT NULL,
    [Explanation]  NVARCHAR (MAX) NULL,
    [Examples]     NVARCHAR (MAX) NULL,
    [CreatedAt]    DATETIME       DEFAULT (getdate()) NULL,
    [UpdatedAt]    DATETIME       NULL,
    PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_VocabularyAi_Vocabulary] FOREIGN KEY ([VocabularyId]) REFERENCES [dbo].[Vocabulary] ([Id])
);

-- Users
CREATE TABLE [dbo].[Users] (
    [Id]           INT            IDENTITY (1, 1) NOT NULL,
    [Username]     NVARCHAR (50)  NOT NULL,
    [Email]        NVARCHAR (100) NOT NULL,
    [Password]     NVARCHAR (255) NOT NULL,
    [ProfileImage] NVARCHAR (MAX) NULL,
    PRIMARY KEY CLUSTERED ([Id] ASC),
    UNIQUE NONCLUSTERED ([Email] ASC),
    UNIQUE NONCLUSTERED ([Username] ASC)
);

-- UserProgress
CREATE TABLE [dbo].[UserProgress] (
    [Id]           INT           IDENTITY (1, 1) NOT NULL,
    [UserId]       INT           NOT NULL,
    [VocabularyId] INT           NOT NULL,
    [CorrectCount] INT           DEFAULT ((0)) NULL,
    [WrongCount]   INT           DEFAULT ((0)) NULL,
    [LastReviewed] DATETIME      NULL,
    [Status]       NVARCHAR (20) DEFAULT ('new') NULL,
    PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]),
    CONSTRAINT [FK_Vocab] FOREIGN KEY ([VocabularyId]) REFERENCES [dbo].[Vocabulary] ([Id])
);
GO
CREATE NONCLUSTERED INDEX [IX_UserProgress_UserId_VocabId]
    ON [dbo].[UserProgress]([UserId] ASC, [VocabularyId] ASC)
    INCLUDE([Status]);
```

**b)** Seed the `Vocabulary` table by importing [`vocab.csv`](vocab.csv).

### 4. Run the app

```bash
dotnet run
```

Visit `https://localhost:7000` in your browser.



## API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/users/register` | Register a new account |
| POST | `/api/users/login` | Login and receive JWT |
| POST | `/api/users/refresh` | Refresh JWT token |
| POST | `/api/users/logout` | Clear auth cookie |
| GET | `/api/users/me` | Get current user (auth required) |
| PUT | `/api/users/me` | Update profile (auth required) |
| POST | `/api/users/me/upload-image` | Upload avatar (auth required) |
| DELETE | `/api/users/me` | Delete account (auth required) |

### Vocabulary
| Method | Route | Description |
|---|---|---|
| GET | `/api/vocabulary/guest` | Public vocabulary list with pagination |
| GET | `/api/vocabulary` | Vocabulary with user status (auth required) |
| PUT | `/api/vocabulary/reset` | Reset status to "new" (auth required) |

### Flashcards
| Method | Route | Description |
|---|---|---|
| GET | `/api/flashcards/all` | All flashcards (guest) |
| GET | `/api/flashcards/by-level?level=N5` | Flashcards with progress |
| POST | `/api/flashcards/mark-learned` | Mark a word as learned (auth required) |
| POST | `/api/flashcards/toggle-flag` | Toggle flag on a word (auth required) |

### Quiz
| Method | Route | Description |
|---|---|---|
| GET | `/api/quiz/{count}?level=N4` | Get random quiz questions |
| POST | `/api/quiz/submit` | Submit an answer |

### AI
| Method | Route | Description |
|---|---|---|
| GET | `/api/ai/explain?word=…` | Basic AI explanation (no cache) |
| GET | `/api/ai/explain/{vocabId}` | Cached AI explanation |
| POST | `/api/ai/regenerate/{vocabId}` | Force-refresh AI explanation |

### Dashboard
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard` | Get accuracy stats (auth required) |



## Database Schema

| Table | Key Columns |
|---|---|
| `Vocabulary` | `Id`, `JapaneseWord`, `Hiragana`, `Meaning`, `Level` (N5–N1) |
| `VocabularyAi` | `Id`, `VocabularyId` (FK), `Explanation`, `Examples` (JSON), `CreatedAt`, `UpdatedAt` |
| `Users` | `Id`, `Username` (unique), `Email` (unique), `Password`, `ProfileImage` |
| `UserProgress` | `Id`, `UserId` (FK), `VocabularyId` (FK), `CorrectCount`, `WrongCount`, `LastReviewed`, `Status` |

**Status values** for `UserProgress.Status`: `new` · `flagged` · `learned`


