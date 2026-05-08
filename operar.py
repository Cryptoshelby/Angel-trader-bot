import sys
import asyncio
from pyquotex.stable_api import Quotex

async def operar(par, direccion, monto=10):
    client = Quotex(email="angelbep20@gmail.com", password="Legnay240613")
    try:
        await client.connect()
        if direccion == "CALL":
            result = await client.buy(par, monto, "call")
        else:
            result = await client.buy(par, monto, "put")
        print("OK" if result else "FAIL")
        await client.close()
    except Exception as e:
        print("ERROR:", e)

par = sys.argv[1] if len(sys.argv) > 1 else "EURUSD"
dir = "CALL" if "CALL" in sys.argv[2] else "PUT" if len(sys.argv) > 2 else "CALL"
monto = int(sys.argv[3]) if len(sys.argv) > 3 else 10

asyncio.run(operar(par, dir, monto))
