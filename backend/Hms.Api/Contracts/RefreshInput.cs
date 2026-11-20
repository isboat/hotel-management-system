using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record RefreshInput([Required, StringLength(128)] string RefreshToken);
