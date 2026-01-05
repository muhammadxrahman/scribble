using Microsoft.EntityFrameworkCore;
using ScribbleAPI.Models;

namespace ScribbleAPI.Data;

public class ApplicationDbContext : DbContext
{
    
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
        
    }

    // Tables
    public DbSet<User> Users { get; set; }
    public DbSet<Document> Documents { get; set; }
    public DbSet<DocumentShare> DocumentShares { get; set; }
    public DbSet<DocumentVersion> DocumentVersions { get; set; }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Username).HasMaxLength(15);
            entity.Property(e => e.Email).HasMaxLength(30);
            entity.Property(e => e.DisplayName).HasMaxLength(100);
        });

        // Document
        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OwnerId);
            entity.Property(e => e.Title).HasMaxLength(255);
            entity.Property(e => e.Content).HasColumnType("text");
            
            // Relationship: Document belongs to User (Owner)
            entity.HasOne(d => d.Owner)
                .WithMany(u => u.Documents)
                .HasForeignKey(d => d.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // DocumentShare
        modelBuilder.Entity<DocumentShare>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.DocumentId, e.UserId }).IsUnique(); // One share per user per document
            
            // Relationship: DocumentShare belongs to Document
            entity.HasOne(ds => ds.Document)
                .WithMany(d => d.Shares)
                .HasForeignKey(ds => ds.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
            
            // Relationship: DocumentShare belongs to User
            entity.HasOne(ds => ds.User)
                .WithMany(u => u.SharedDocuments)
                .HasForeignKey(ds => ds.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // DocumentVersion
        modelBuilder.Entity<DocumentVersion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.DocumentId, e.VersionNumber }).IsUnique();
            entity.Property(e => e.Content).HasColumnType("text");
            
            // Relationship: DocumentVersion belongs to Document
            entity.HasOne(dv => dv.Document)
                .WithMany(d => d.Versions)
                .HasForeignKey(dv => dv.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

    }

}