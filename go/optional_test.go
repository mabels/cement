package cement

import "testing"

func TestOptionDefault(t *testing.T) {
	val := struct {
		opt Optional[int]
	}{}
	if val.opt.IsNone() != true {
		t.Fatal("Expected None")
	}
}

func TestOptionNone(t *testing.T) {
	val := struct {
		opt Optional[int]
	}{
		opt: None[int](),
	}
	if val.opt.IsNone() != true {
		t.Fatal("Expected None")
	}
}
