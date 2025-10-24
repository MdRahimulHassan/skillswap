package handlers

import (
	"net/http"

	"github.com/gorilla/handlers"
)

func CORS(opts ...handlers.CORSOption) func(h interface{}) interface{} {
	return func(h interface{}) interface{} {
		return handlers.CORS(opts...)(h.(interface {
			ServeHTTP(http.ResponseWriter, *http.Request)
		}))
	}
}
