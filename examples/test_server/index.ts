import { RpcServer, IRpcServer } from '../../dist'
import { TestMiddleware } from './test_middleware'

const host = 'localhost'
const port = 3000

console.log(`Running RPC server at http://${host}:${port}`)
const rpcServer: IRpcServer = new RpcServer({ host, port })

rpcServer.on('result', event =>
  console.log('Server result message:\n', event.result)
)

rpcServer.addMiddleware('TestClass', new TestMiddleware()).start()
