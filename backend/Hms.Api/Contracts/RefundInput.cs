using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record RefundInput(Guid PaymentId, [Required, StringLength(80)] string Reference,
    [Range(1, 100000000)] long Amount, [Required, StringLength(250)] string Reason);
