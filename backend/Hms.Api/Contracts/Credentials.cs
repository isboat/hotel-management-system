using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record Credentials([Required, EmailAddress] string Email, [Required, StringLength(256)] string Password);
