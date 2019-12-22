import { RpcMiddleware, RpcMethod } from '../../lib'

interface ITestMethodParams {
  hello: string
}

interface ICalcSumParams {
  a: number,
  b: number
}

export class BaseMiddleware extends RpcMiddleware {
  @RpcMethod()
  async testMethod (p: ITestMethodParams): Promise<string> {
    return `This is a test string: ${p?.hello}:${Math.random()}`
  }
}

export class TestMiddleware extends BaseMiddleware {
  @RpcMethod()
  async calcSum (p: ICalcSumParams): Promise<number> {
    return p.a + p.b
  }
}
