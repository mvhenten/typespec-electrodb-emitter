import DynamoDB from "@aws-sdk/client-dynamodb";
import { Entity } from "electrodb";
import Entities from "../tsp-output/@stxtech/electrodb-emitter/entities";

const client = new DynamoDB.DocumentClient();

// highlight-next-line
const table = "electro";
import { Entity } from "electrodb";
