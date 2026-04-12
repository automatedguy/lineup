export interface Agent<TInput, TOutput> {
  name: string;
  run(input: TInput): Promise<TOutput>;
}
