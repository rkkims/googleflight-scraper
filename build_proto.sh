#!/bin/bash
python -m grpc_tools.protoc -I. --python_out=proto flights.proto
echo "Proto copiled to proto/flights_pb2.py"