const express = require("express");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Starting server at http://localhost:3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStatesObjIntoResponseObj = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

const convertDistrictObjIntoResponseObj = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};

app.get("/login/", async (request, response) => {
  const getAUserQuery = `
      SELECT * FROM user;
    `;
  const dbUser = await db.all(getAUserQuery);
  response.send(dbUser);
});

const authenticationToken = (request, response, next) => {
  let jwToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwToken = authHeaders.split(" ")[1];
  }
  if (jwToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwToken, "MY_ACCESS_TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//api-1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
     SELECT * FROM user WHERE username = '${username}';
  `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "MY_ACCESS_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api-2
app.get("/states/", authenticationToken, async (request, response) => {
  const getUserDetailsQuery = `
     SELECT * FROM state;
  `;
  const statesArray = await db.all(getUserDetailsQuery);
  response.send(
    statesArray.map((eachState) => convertStatesObjIntoResponseObj(eachState))
  );
});

//api-3
app.get("/states/:stateId", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
       SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const state = await db.get(getStateQuery);
  response.send(convertStatesObjIntoResponseObj(state));
});

//api-4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addingANewDistrictQuery = `
       INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
       VALUES (
           '${districtName}',
           ${stateId},
           ${cases},
           ${cured},
           ${active},
           ${deaths}
       );
    `;
  await db.run(addingANewDistrictQuery);
  response.send("District Successfully Added");
});

//api-5
app.get(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `
       SELECT * FROM district WHERE district_id = ${districtId};
    `;
    const district = await db.get(getDistrictDetailsQuery);
    response.send(convertDistrictObjIntoResponseObj(district));
  }
);

//api-6
app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteADistrictQuery = `
      DELETE FROM district WHERE district_id = ${districtId};
    `;
    await db.run(deleteADistrictQuery);
    response.send("District Removed");
  }
);

//api-7
app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const addingANewDistrictQuert = `
       UPDATE district 
       SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
        WHERE district_id = ${districtId};
    `;
    await db.run(addingANewDistrictQuert);
    response.send("District Details Updated");
  }
);

//api-8
app.get(
  "/states/:stateId/stats",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getDetailStatsQuery = `
       SELECT 
         SUM(cases) AS totalCases,
         SUM(cured) AS totalCured,
         SUM(active) AS totalActive,
         SUM(deaths) AS totalDeaths
       FROM district WHERE state_id = ${stateId};
    `;
    const stateDetails = await db.get(getDetailStatsQuery);
    response.send(stateDetails);
  }
);

module.exports = app;
