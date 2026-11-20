using Hms.Api.Data;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Hosting;

namespace Hms.Tests;

public sealed class HotelApiTests
{
    [Fact]
    public async Task StaffCanBookAndRecordCashOnlyWithinTheirTenant()
    {
        var directory = Directory.CreateTempSubdirectory();
        try
        {
            const string password = "Test-only-strong-password";
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["Jwt:Key"] = Guid.NewGuid().ToString(),
                        ["ConnectionStrings:Local"] = $"Data Source={Path.Combine(directory.FullName, "test.db")};Pooling=False",
                        ["Bootstrap:Email"] = "platform@example.test",
                        ["Bootstrap:Password"] = password
                    }));
            });
            using var platform = factory.CreateClient();
            using var staff = factory.CreateClient();
            Assert.Equal(HttpStatusCode.Unauthorized, (await staff.GetAsync("/api/v1/auth/properties")).StatusCode);
            await SignIn(platform, "platform@example.test", password);
            var hotel = await CreateHotel(platform, "Accra Lodge");
            var other = await CreateHotel(platform, "Kumasi Lodge");
            var detailsUpdate = new { name = "Accra Lodge", telephone = "+233 24 123 4567", description = "A small guest house", address = "12 High Street, Accra" };
            Assert.Equal(HttpStatusCode.NoContent, (await platform.PutAsJsonAsync($"/api/v1/platform/properties/{hotel}", detailsUpdate)).StatusCode);
            var tenants = await Read(await platform.GetAsync("/api/v1/platform/properties"));
            var updatedHotel = Assert.Single(tenants.EnumerateArray(), row => row.GetProperty("id").GetString() == hotel);
            Assert.Equal(detailsUpdate.telephone, updatedHotel.GetProperty("telephone").GetString());
            Assert.Equal(detailsUpdate.description, updatedHotel.GetProperty("description").GetString());
            Assert.Equal(detailsUpdate.address, updatedHotel.GetProperty("address").GetString());
            Assert.Equal(HttpStatusCode.OK, (await platform.PostAsJsonAsync($"/api/v1/platform/properties/{hotel}/administrator",
                new { email = "admin@example.test", name = "Property Admin", role = "Administrator", password })).StatusCode);
            var session = await SignIn(staff, "admin@example.test", password);
            var refresh = new { refreshToken = session.GetProperty("refreshToken").GetString() };
            var rotated = await Read(await staff.PostAsJsonAsync("/api/v1/auth/refresh", refresh));
            Assert.NotEqual(refresh.refreshToken, rotated.GetProperty("refreshToken").GetString());
            Assert.Equal(HttpStatusCode.Unauthorized, (await staff.PostAsJsonAsync("/api/v1/auth/refresh", refresh)).StatusCode);
            var path = $"/api/v1/properties/{hotel}";
            Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsJsonAsync("/api/v1/platform/properties", new { name = "Denied" })).StatusCode);
            var guest = await Read(await staff.PostAsJsonAsync($"{path}/guests", new { name = "Smith", idNumber = "  GHA-00123  " }));
            var guestId = guest.GetProperty("id").GetGuid();
            var details = await Read(await staff.GetAsync($"{path}/guests/{guestId}"));
            Assert.Equal("GHA-00123", details.GetProperty("idNumber").GetString());
            var directoryListing = await Read(await staff.GetAsync($"{path}/guests"));
            Assert.False(Assert.Single(directoryListing.EnumerateArray()).TryGetProperty("idNumber", out _));
            Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync($"{path}/guests/{guestId}",
                new { name = "Smith", idNumber = "000123" })).StatusCode);
            var updated = await Read(await staff.GetAsync($"{path}/guests/{guestId}"));
            Assert.Equal("000123", updated.GetProperty("idNumber").GetString());
            Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"/api/v1/properties/{other}/guests/{guestId}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"/api/v1/properties/{other}/rooms")).StatusCode);
            var room = await Read(await staff.PostAsJsonAsync($"{path}/rooms", new { number = "101", type = "Double", capacity = 2, rate = 35000, description = "  Garden view  " }));
            Assert.Equal("Garden view", room.GetProperty("description").GetString());
            var roomId = room.GetProperty("id").GetString();
            Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync($"{path}/rooms/{roomId}",
                new { number = "101", type = "Double", capacity = 2, rate = 35000, description = "Garden view and balcony" })).StatusCode);
            var rooms = await Read(await staff.GetAsync($"{path}/rooms"));
            Assert.Equal("Garden view and balcony", Assert.Single(rooms.EnumerateArray()).GetProperty("description").GetString());
            var booking = new { roomId, guest = "Test guest", arrival = "2026-12-03", departure = "2026-12-04" };
            var results = await Task.WhenAll(
                staff.PostAsJsonAsync($"{path}/reservations", booking),
                staff.PostAsJsonAsync($"{path}/reservations", booking));
            Assert.Single(results, response => response.StatusCode == HttpStatusCode.Conflict);
            var stay = await Read(Assert.Single(results, response => response.IsSuccessStatusCode));
            var folio = $"{path}/folios/{stay.GetProperty("id").GetString()}";
            var shift = await Read(await staff.PostAsJsonAsync($"{path}/cash-shifts", new { amount = 10000 }));
            var shifts = await Read(await staff.GetAsync($"{path}/cash-shifts"));
            var listedShift = Assert.Single(shifts.EnumerateArray());
            Assert.Equal("Property Admin", listedShift.GetProperty("cashierName").GetString());
            Assert.Equal("ADMIN@EXAMPLE.TEST", listedShift.GetProperty("cashierEmail").GetString());
            Assert.Equal(10000, listedShift.GetProperty("float").GetInt64());
            var cash = new { reference = "test-receipt", amount = 25000, tendered = 30000 };
            var receipt = await Read(await staff.PostAsJsonAsync($"{folio}/payments", cash));
            var retry = await Read(await staff.PostAsJsonAsync($"{folio}/payments", cash));
            Assert.Equal(receipt.GetProperty("id").GetString(), retry.GetProperty("id").GetString());
            Assert.Equal(10000, (await Read(await staff.GetAsync(folio))).GetProperty("balance").GetInt64());
            var refund = new { paymentId = receipt.GetProperty("id").GetString(), reference = "test-refund", amount = 5000, reason = "Test refund" };
            await Read(await staff.PostAsJsonAsync($"{folio}/refunds", refund));
            var closed = await Read(await staff.PostAsJsonAsync($"{path}/cash-shifts/{shift.GetProperty("id").GetString()}/close", new { amount = 30000 }));
            Assert.Equal(30000, closed.GetProperty("expected").GetInt64());
            // Seed an active stay hidden behind 250 later arrivals.
            var hotelId = Guid.Parse(hotel);
            var activeRoomId = Guid.NewGuid();
            var activeStayId = Guid.NewGuid();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var yesterday = today.AddDays(-1);
            var tomorrow = today.AddDays(1);
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var database = scope.ServiceProvider.GetRequiredService<HotelDatabase>();
                database.Rooms.Add(new Room(hotelId, activeRoomId, "102", "Double", 2, 0, "Clean"));
                database.Reservations.Add(new Reservation(hotelId, activeStayId, activeRoomId, "Long Stay", yesterday, tomorrow, 0, "CheckedIn"));
                database.Reservations.AddRange(Enumerable.Range(0, 250).Select(day =>
                    new Reservation(hotelId, Guid.NewGuid(), activeRoomId, "Future Guest", tomorrow.AddDays(day), tomorrow.AddDays(day + 1), 0)));
                database.RoomNights.AddRange(new RoomNight(hotelId, activeRoomId, yesterday, activeStayId),
                    new RoomNight(hotelId, activeRoomId, today, activeStayId));
                await database.SaveChangesAsync();
            }
            var firstPage = await Read(await staff.GetAsync($"{path}/reservations"));
            Assert.Equal(250, firstPage.GetArrayLength());
            Assert.DoesNotContain(firstPage.EnumerateArray(), row => row.GetProperty("id").GetGuid() == activeStayId);
            var filtered = await Read(await staff.GetAsync($"{path}/reservations?status=CheckedIn&search=long%20stay"));
            Assert.Equal(activeStayId, Assert.Single(filtered.EnumerateArray()).GetProperty("id").GetGuid());
            var overview = await Read(await staff.GetAsync($"{path}/reservations?status=CheckedIn&departure={tomorrow:yyyy-MM-dd}"));
            Assert.Equal(activeStayId, Assert.Single(overview.EnumerateArray()).GetProperty("id").GetGuid());
            Assert.Equal(HttpStatusCode.NoContent, (await staff.PatchAsJsonAsync($"{path}/reservations/{activeStayId}", new { status = "CheckedOut" })).StatusCode);
            var availability = await Read(await staff.GetAsync($"{path}/availability?arrival={today:yyyy-MM-dd}&departure={tomorrow:yyyy-MM-dd}"));
            Assert.Contains(availability.EnumerateArray(), row => row.GetProperty("id").GetGuid() == activeRoomId);
            var priorNight = await Read(await staff.GetAsync($"{path}/availability?arrival={yesterday:yyyy-MM-dd}&departure={today:yyyy-MM-dd}"));
            Assert.DoesNotContain(priorNight.EnumerateArray(), row => row.GetProperty("id").GetGuid() == activeRoomId);
            await Read(await staff.PostAsJsonAsync($"{path}/reservations", new { roomId = activeRoomId, guest = "Replacement Guest", arrival = today, departure = tomorrow }));
            var swagger = await Read(await staff.GetAsync("/swagger/v1/swagger.json"));
            Assert.Equal("Hotel Management API", swagger.GetProperty("info").GetProperty("title").GetString());
            var audit = await Read(await staff.GetAsync($"{path}/audit"));
            Assert.Contains(audit.EnumerateArray(), row => row.GetProperty("outcome").GetInt32() == 409);
            Assert.DoesNotContain("GHA-00123", audit.GetRawText());
            Assert.DoesNotContain("000123", audit.GetRawText());
            Assert.Contains(audit.EnumerateArray(), row => row.GetProperty("action").GetString() == "logged in" &&
                row.GetProperty("staffName").GetString() == "Property Admin");
            Assert.Contains(audit.EnumerateArray(), row => row.GetProperty("action").GetString() == "assigned guest (Test guest) to Room 101");
            Assert.Contains(audit.EnumerateArray(), row => row.GetProperty("action").GetString() == "viewed guest (Smith) details" &&
                row.GetProperty("staffName").GetString() == "Property Admin" &&
                row.GetProperty("staffEmail").GetString() == "ADMIN@EXAMPLE.TEST");
            Assert.Equal(HttpStatusCode.NoContent, (await platform.PatchAsJsonAsync($"/api/v1/platform/properties/{hotel}", new { status = "Suspended" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"{path}/rooms")).StatusCode);
        }
        finally
        {
            Directory.Delete(directory.FullName, recursive: true);
        }
    }

    private static async Task<JsonElement> SignIn(HttpClient client, string email, string password)
    {
        var session = await Read(await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.GetProperty("token").GetString());
        return session;
    }

    private static async Task<string> CreateHotel(HttpClient client, string name) =>
        (await Read(await client.PostAsJsonAsync("/api/v1/platform/properties", new { name }))).GetProperty("id").GetString()!;

    private static async Task<JsonElement> Read(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {body}");
        using var json = JsonDocument.Parse(body);
        return json.RootElement.Clone();
    }
}
