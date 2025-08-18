package middleware

import (
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORSMiddleware(allowedOrigins []string, allowCredentials bool) gin.HandlerFunc {
	config := cors.DefaultConfig()

	if len(allowedOrigins) > 0 {
		config.AllowOrigins = allowedOrigins
	} else {
		config.AllowAllOrigins = true
	}

	config.AllowCredentials = allowCredentials
	config.AllowHeaders = []string{
		"Origin",
		"Content-Length",
		"Content-Type",
		"Authorization",
		"X-Requested-With",
		"Accept",
		"Accept-Language",
		"Accept-Encoding",
		"Connection",
		"Access-Control-Allow-Origin",
	}

	config.AllowMethods = []string{
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
		"HEAD",
		"OPTIONS",
	}

	config.ExposeHeaders = []string{
		"Content-Length",
		"Content-Type",
		"Content-Disposition",
	}

	config.MaxAge = 12 * 60 * 60 // 12 hours

	return cors.New(config)
}

func parseCORSOrigins(originsStr string) []string {
	if originsStr == "" {
		return nil
	}

	origins := strings.Split(originsStr, ",")
	var result []string

	for _, origin := range origins {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}
