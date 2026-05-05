export class InvalidEvent extends Error {
  readonly errors: any;

  constructor(errors: any) {
    super('Unable to parse event');
    this.errors = errors;
  }
}
