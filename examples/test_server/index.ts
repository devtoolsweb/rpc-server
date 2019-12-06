import { RpcServer, IRpcServer } from '../../lib'
import { TestMiddleware } from './test_middleware'

const host = 'localhost'
const port = 3000

console.log(`Running RPC server at http://${host}:${port}`)
const rpcServer: IRpcServer = new RpcServer({ host, port })

rpcServer.on('result', event =>
  console.log(
    `Server result message at ${new Date()} :`,
    JSON.stringify(event.result, null, '  ')
  )
)

rpcServer.addMiddleware('TestDomain', new TestMiddleware()).start()
