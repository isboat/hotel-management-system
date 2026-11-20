using Hms.Api.Data;

namespace Hms.Api.Security;

/// <summary>Records outcomes for named user actions without logging request bodies or credentials.</summary>
public sealed class AuditMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IServiceScopeFactory scopes)
    {
        var activity = context.GetEndpoint()?.Metadata.GetMetadata<AuditActionAttribute>();
        if (activity is null)
        {
            await next(context);
            return;
        }

        var outcome = 500;
        try
        {
            await next(context);
            outcome = context.Response.StatusCode;
        }
        finally
        {
            var failed = outcome >= 400;
            var action = failed ? $"could not {activity.Attempt}"
                : context.Features.Get<AuditActionAttribute.AuditDescription>()?.Text ?? activity.Success;
            // Financial changes write their success events in the business transaction.
            if (failed || action.Length > 0)
            {
                await using var scope = scopes.CreateAsyncScope();
                var database = scope.ServiceProvider.GetRequiredService<HotelDatabase>();
                var hotel = Guid.TryParse(context.Request.RouteValues["hotelId"]?.ToString(), out var id) ? id : (Guid?)null;
                database.Audit.Add(new AuditEvent(Guid.NewGuid(), hotel,
                    context.Items["AuditActor"] as Guid? ?? TenantAccess.Actor(context.User),
                    DateTime.UtcNow, action, context.Request.Path.Value ?? "", outcome, context.TraceIdentifier));
                await database.SaveChangesAsync();
            }
        }
    }
}
