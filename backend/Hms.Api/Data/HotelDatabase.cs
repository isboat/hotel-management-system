using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

/// <summary>Defines property-scoped relationships and booking and receipt uniqueness.</summary>
public sealed class HotelDatabase(DbContextOptions<HotelDatabase> options) : DbContext(options)
{
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<GuestProfile> Guests => Set<GuestProfile>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<RoomNight> RoomNights => Set<RoomNight>();
    public DbSet<FolioCharge> Charges => Set<FolioCharge>();
    public DbSet<CashShift> CashShifts => Set<CashShift>();
    public DbSet<CashPayment> Payments => Set<CashPayment>();
    public DbSet<AuditEvent> Audit => Set<AuditEvent>();
    public DbSet<MaintenanceIssue> Maintenance => Set<MaintenanceIssue>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();

    public DbSet<RefreshSession> RefreshSessions => Set<RefreshSession>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Staff>().Property(row => row.Email).HasMaxLength(254);
        model.Entity<Room>().Property(row => row.Number).HasMaxLength(30);
        model.Entity<CashPayment>().Property(row => row.Reference).HasMaxLength(80);
        model.Entity<PasswordReset>().Property(row => row.Digest).HasMaxLength(64);
        model.Entity<RefreshSession>().Property(row => row.Digest).HasMaxLength(64);
        model.Entity<Staff>().HasIndex(row => row.Email).IsUnique();
        model.Entity<Membership>().HasKey(row => new { row.HotelId, row.StaffId });
        model.Entity<Membership>().HasOne<Hotel>().WithMany().HasForeignKey(row => row.HotelId);
        model.Entity<Membership>().HasOne<Staff>().WithMany().HasForeignKey(row => row.StaffId);
        model.Entity<Room>().HasKey(row => new { row.HotelId, row.Id });
        model.Entity<Room>().HasIndex(row => new { row.HotelId, row.Number }).IsUnique();
        model.Entity<Room>().HasOne<Hotel>().WithMany().HasForeignKey(row => row.HotelId);
        model.Entity<GuestProfile>().HasKey(row => new { row.HotelId, row.Id });
        model.Entity<GuestProfile>().HasOne<Hotel>().WithMany().HasForeignKey(row => row.HotelId);
        model.Entity<Reservation>().HasOne<GuestProfile>().WithMany().HasForeignKey(row => new { row.HotelId, row.GuestId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Reservation>().HasKey(row => new { row.HotelId, row.Id });
        model.Entity<Reservation>().HasOne<Room>().WithMany().HasForeignKey(row => new { row.HotelId, row.RoomId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<RoomNight>().HasKey(row => new { row.HotelId, row.RoomId, row.Date });
        model.Entity<RoomNight>().HasOne<Reservation>().WithMany().HasForeignKey(row => new { row.HotelId, row.ReservationId });
        model.Entity<FolioCharge>().HasOne<Reservation>().WithMany().HasForeignKey(row => new { row.HotelId, row.ReservationId });
        model.Entity<CashShift>().HasKey(row => new { row.HotelId, row.Id });
        model.Entity<CashShift>().HasIndex(row => new { row.HotelId, row.CashierId }).IsUnique().HasFilter("[ClosedUtc] IS NULL");
        model.Entity<CashShift>().HasOne<Hotel>().WithMany().HasForeignKey(row => row.HotelId);
        model.Entity<CashPayment>().HasOne<CashShift>().WithMany().HasForeignKey(row => new { row.HotelId, row.ShiftId }).OnDelete(DeleteBehavior.Restrict);
        model.Entity<CashPayment>().HasIndex(row => new { row.HotelId, row.Reference }).IsUnique();
        model.Entity<CashPayment>().HasOne<Reservation>().WithMany().HasForeignKey(row => new { row.HotelId, row.ReservationId });
        model.Entity<MaintenanceIssue>().HasOne<Room>().WithMany().HasForeignKey(row => new { row.HotelId, row.RoomId });
        model.Entity<AuditEvent>().HasIndex(row => new { row.HotelId, row.Utc });
        model.Entity<PasswordReset>().HasKey(row => row.Digest);
        model.Entity<RefreshSession>().HasKey(row => row.Digest);
        model.Entity<RefreshSession>().HasIndex(row => row.ExpiresUtc);
    }
}
