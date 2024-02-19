package cement

type Optional[T any] struct{ t *T }

func (o Optional[T]) IsNone() bool {
	return o.t == nil
}

func (o Optional[T]) IsSome() bool {
	return o.t != nil
}

func (o Optional[T]) Value() T {
	return *o.t
}

func (o Optional[T]) Ref() *T {
	return o.t
}

func OptionalToPtr[T any](t Optional[T]) *T {
	if t.IsNone() {
		return nil
	}
	return t.Ref()
}

func OptionalFromPtr[T any](t *T) Optional[T] {
	if t == nil {
		return None[T]()
	}
	return Some[T](*t)
}

func None[T any]() Optional[T] {
	return Optional[T]{
		t: nil,
	}
}

// type some[T any] struct {
// 	t T
// }

func Some[T any](t T) Optional[T] {
	return Optional[T]{t: &t}
}

// func (o some[T]) IsNone() bool {
// 	return false
// }

// func (o some[T]) Value() T {
// 	return o.t
// }
