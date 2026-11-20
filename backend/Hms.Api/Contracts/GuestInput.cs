using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record GuestInput([Required, StringLength(150)] string Name, [EmailAddress, StringLength(254)] string? Email,
    [StringLength(40)] string? Phone, [StringLength(500)] string? Preferences, bool MarketingOptIn, [StringLength(64)] string? IdNumber);
