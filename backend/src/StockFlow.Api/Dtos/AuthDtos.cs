using System.ComponentModel.DataAnnotations;

namespace StockFlow.Api.Dtos;

public record LoginRequest(
    [Required] string Username,
    [Required] string Password);

public record LoginResponse(
    string Token,
    DateTime ExpiresAt,
    string Username,
    string FullName,
    string Role);
