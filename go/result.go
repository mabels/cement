package cement

import "fmt"

type Result[T any] interface {
	IsOk() bool
	IsErr() bool
	Err() error
	Ok() T
	Unwrap() T
	UnwrapErr() error
}

type ResultOK[T any] struct {
	t T
}

func (r ResultOK[T]) Unwrap() T {
	return r.Ok()
}

func (r ResultOK[T]) UnwrapErr() error {
	return r.Err()
}

func (r ResultOK[T]) IsOk() bool {
	return true
}
func (r ResultOK[T]) IsErr() bool {
	return !r.IsOk()
}

func (r ResultOK[T]) Err() error {
	panic("Result is Ok")
}
func (r ResultOK[T]) Ok() T {
	return r.t
}

type ResultError[T any] struct {
	t error
}

func (r ResultError[T]) IsOk() bool {
	return false
}
func (r ResultError[T]) IsErr() bool {
	return !r.IsOk()
}

func (r ResultError[T]) Ok() T {
	panic(fmt.Errorf("Result is Err:%v", r.t.Error()))
}

func (r ResultError[T]) Unwrap() T {
	return r.Ok()
}

func (r ResultError[T]) UnwrapErr() error {
	return r.Err()
}

func (r ResultError[T]) Err() error {
	return r.t
}

func Ok[T any](t T) Result[T] {
	return ResultOK[T]{
		t: t,
	}
}

func Err[T any](t any) Result[T] {
	e, ok := t.(error)
	if ok {
		return ResultError[T]{t: e}
	}
	s, ok := t.(string)
	if ok {
		return ResultError[T]{t: fmt.Errorf(s)}
	}
	panic("Err must be error or string")
}

func Is[T any](t any) bool {
	switch t.(type) {
	case ResultOK[T], ResultError[T]:
		return true
	default:
		return false
	}
}
