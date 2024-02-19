package cement

import (
	"fmt"
	"testing"

	"gotest.tools/v3/assert"
)

func TestResultOK(t *testing.T) {
	result := Ok(1)
	assert.Equal(t, result.IsOk(), true)
	assert.Equal(t, result.Ok(), 1)
	assert.Equal(t, result.Unwrap(), 1)

	assert.Equal(t, result.IsErr(), false)
}

func TestResultError(t *testing.T) {
	result := Err[int](fmt.Errorf("xxx"))
	assert.Equal(t, result.IsOk(), false)
	assert.Equal(t, result.Err().Error(), "xxx")
	assert.Equal(t, result.UnwrapErr().Error(), "xxx")

	assert.Equal(t, result.IsErr(), true)
	assert.Equal(t, result.IsErr(), true)
}

func TestIsResult(t *testing.T) {
	assert.Equal(t, Is[int](Ok(1)), true)
	assert.Equal(t, Is[int](Err[int]("xxx")), true)
	assert.Equal(t, Is[int](44), false)
}
