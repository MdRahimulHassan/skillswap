package utils

import "fmt"

func ParseInt(s string) int {
	var i int
	fmt.Sscanf(s, "%d", &i)
	return i
}
