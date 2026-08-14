FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /vaija-api ./cmd/api

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && addgroup -S vaija && adduser -S vaija -G vaija
USER vaija
COPY --from=build /vaija-api /usr/local/bin/vaija-api
EXPOSE 3001
ENTRYPOINT ["vaija-api"]
