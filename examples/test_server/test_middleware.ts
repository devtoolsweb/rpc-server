import { RpcMiddleware, RpcMethod } from '../../lib'
import { IRpcError, RpcError, RpcErrorCodeEnum } from '@aperos/rpc-common'

interface ITestMethodParams {
  hello: string
}

interface ICalcSumParams {
  a: number
  b: number
}

export class BaseMiddleware extends RpcMiddleware {
  @RpcMethod()
  async testMethod(p: ITestMethodParams): Promise<string> {
    return `This is a test string: ${p?.hello}:${Math.random()}`
  }
}

export class TestMiddleware extends BaseMiddleware {
  @RpcMethod()
  async calcSum(p: ICalcSumParams): Promise<number> {
    return p.a + p.b
  }

  @RpcMethod()
  async getErrorResult(): Promise<number | IRpcError> {
    return new RpcError({
      code: RpcErrorCodeEnum.InternalError,
      message: 'Internal error in the test middleware occured'
    })
  }

  @RpcMethod()
  async methodWithException(): Promise<number | IRpcError> {
    throw new Error('Exception thrown in test middleware')
  }
}
