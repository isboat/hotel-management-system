using System.ComponentModel.DataAnnotations;

namespace Hms.Api.Contracts;

public sealed record ClientActivityInput([Required, StringLength(40)] string Screen, [Required, StringLength(10)] string Interaction);
