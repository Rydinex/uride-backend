# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
FROM node:18 AS node

# Copy backend source
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY . .

# Install Node if needed for frontend assets
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Restore and build .NET
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend-build /app/publish .

ENTRYPOINT ["dotnet", "URide.dll"]