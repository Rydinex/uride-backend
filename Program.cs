var builder = WebApplication.CreateBuilder(args);

var configuredOrigins = builder.Configuration["CORS_ALLOWED_ORIGINS"];
var allowedOrigins = string.IsNullOrWhiteSpace(configuredOrigins)
    ? new[] { "https://rydinex.com", "https://www.rydinex.com" }
    : configuredOrigins
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// Add services to the container.

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendOrigins", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("FrontendOrigins");

app.UseAuthorization();

app.MapControllers();

app.Run();
