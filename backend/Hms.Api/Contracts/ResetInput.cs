using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record ResetInput([Required, StringLength(128)] string Code, [Required, StringLength(256, MinimumLength = 12)] string Password);
