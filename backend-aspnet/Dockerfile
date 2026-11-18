# Build stage for ASP.NET Core (.NET 10 / C# 13) Backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend-aspnet/EndLessShop.Api.csproj ./
RUN dotnet restore EndLessShop.Api.csproj
COPY backend-aspnet/ ./
RUN dotnet publish EndLessShop.Api.csproj -c Release -o /app/publish --no-restore

# Production Container for ASP.NET Core (.NET 10 / C# 13) Backend
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 3000

ENV ASPNETCORE_URLS=http://+:3000
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

# Copy static frontend assets for direct static file serving
COPY web-ban-quan-ao/ ./wwwroot/
COPY img/ ./wwwroot/img/

USER $APP_UID
ENTRYPOINT ["dotnet", "EndLessShop.Api.dll"]
