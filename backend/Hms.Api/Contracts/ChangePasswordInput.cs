using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record ChangePasswordInput(
    [Required, StringLength(256)] string CurrentPassword,
    [Required, StringLength(256, MinimumLength = 12)] string NewPassword);
