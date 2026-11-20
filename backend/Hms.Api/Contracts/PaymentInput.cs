using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record PaymentInput([Required, StringLength(80)] string Reference, [Range(1, 100000000)] long Amount, [Range(1, 100000000)] long Tendered);
