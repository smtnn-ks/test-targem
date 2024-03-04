var fs = require("fs")
var pg = require("pg")

class User {
    constructor(nickname, email, registrationDate, status) {
        this.nickname = nickname
        this.email = email
        this.registrationDate = conv.strToDate(registrationDate)
        this.status = status
    }
}

var conv = {
    strToDate: function(dtStr) {
        var dateParts = dtStr.split(".")
        var timeParts = dateParts[2].split(" ")[1].split(":")
        dateParts[2] = dateParts[2].split(" ")[0]
        return new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0], timeParts[0], timeParts[1])
    },
    dbResultToHumanReadable: function(result) {
        result.forEach(res => {
            res.registration_date = new Date(res.registration_date * 1000)
            res.status = res.status ? 'On' : 'Off'
        })
    },
    dateToUnix: (date) => Math.floor(date.getTime() / 1000)
}

function handleError(e) {
    console.error(e)
    process.exit(1)
}

async function handleDB(users) {
    var client = new pg.Client({
        user: 'postgres',
        password: 'example',
        host: 'localhost',
        port: 5432,
        database: 'postgres'
    })

    var createTableQuery = `
    CREATE TABLE IF NOT EXISTS usrs (
        id SERIAL PRIMARY KEY,
        nickname TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        registration_date INTEGER NOT NULL,
        status BOOLEAN NOT NULL
    );`

    var insertQuery =
        `INSERT INTO usrs 
    (nickname, email, registration_date, status) 
    VALUES ($1, $2, $3, $4) 
    ON CONFLICT (email) DO UPDATE SET
    nickname = $1, 
    registration_date = $3, 
    status = $4`

    var selectQuery = `SELECT * FROM usrs WHERE status = true ORDER BY registration_date ASC;`

    try {
        await client.connect()
        await client.query(createTableQuery)
        var promises = users.map(usr => {
            client.query(insertQuery, [usr.nickname, usr.email, conv.dateToUnix(usr.registrationDate), usr.status === 'On'])
        })
        await Promise.all(promises)
        var result = await client.query(selectQuery)
        return result.rows
    } catch (e) {
        handleError(e)
    } finally {
        await client.end()
    }
}

if (process.argv.length != 3) handleError("Укажите путь к файлу")

var pathToFile = process.argv[2]
var allFileContent = fs.readFileSync(pathToFile)
var lines = allFileContent.toString().split("\n")
lines = lines.slice(0, lines.length - 1)
var users = lines.map(line => new User(...line.split(";").map(x => x.trim())))
handleDB(users).then(result => {
    conv.dbResultToHumanReadable(result)
    console.table(result)
})
