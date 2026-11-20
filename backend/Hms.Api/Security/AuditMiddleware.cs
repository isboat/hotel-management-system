using Hms.Api.Data;

namespace Hms.Api.Security;

/// <summary>Records API attempts, including reads and rejected requests, independently of business transactions.</summary>
public sealed class AuditMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IServiceScopeFactory scopes)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
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
            await using var scope = scopes.CreateAsyncScope();
            var database = scope.ServiceProvider.GetRequiredService<HotelDatabase>();
            var hotel = Guid.TryParse(context.Request.RouteValues["hotelId"]?.ToString(), out var id) ? id : (Guid?)null;
            var activityRecorded = outcome == 204 && context.Request.Path.Value?.EndsWith("/activity", StringComparison.OrdinalIgnoreCase) == true;
            if (!activityRecorded)
            {
                database.Audit.Add(new AuditEvent(Guid.NewGuid(), hotel, context.Items["AuditActor"] as Guid? ?? TenantAccess.Actor(context.User),
                    DateTime.UtcNow, context.Request.Method, context.Request.Path.Value ?? "", outcome, context.TraceIdentifier));
                await database.SaveChangesAsync();
            }
        }
    }
}
