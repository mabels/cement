interface IType {
  readonly type: string;
}
class _Required implements IType {
  readonly type = "REQUIRED";
}

class _Optional implements IType {
  readonly type = "OPTIONAL";
}

export const param: {
  REQUIRED: _Required;
  OPTIONAL: _Optional;
} = {
  REQUIRED: new _Required(),
  OPTIONAL: new _Optional(),
};
export type param = (typeof param)[keyof typeof param];
