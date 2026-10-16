# Imagen de la API para Render (o cualquier hosting con Docker).
# Se construye desde la carpeta backend: docker build -t stockflow-api backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/StockFlow.Api/StockFlow.Api.csproj src/StockFlow.Api/
RUN dotnet restore src/StockFlow.Api/StockFlow.Api.csproj
COPY src/StockFlow.Api/ src/StockFlow.Api/
RUN dotnet publish src/StockFlow.Api/StockFlow.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# Render indica el puerto en la variable PORT; en local se usa 8080.
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet StockFlow.Api.dll"]
