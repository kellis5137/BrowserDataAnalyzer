import { createWriteStream } from 'fs'
import { randomInt } from 'crypto'

const RECORDS = 100_000
const PHONE_MATCHES = 10_000   // rows 0..9999 in companies match user phone
const ADDR_MATCHES  = 10_000   // rows 10000..19999 in companies match user address

// ── data pools ────────────────────────────────────────────────────────────────

const firstNames = [
  'James','Mary','Robert','Patricia','Michael','Jennifer','William','Linda',
  'David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah',
  'Charles','Karen','Christopher','Lisa','Daniel','Nancy','Matthew','Betty',
  'Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Emily',
  'Paul','Dorothy','Andrew','Kimberly','Joshua','Carol','Kenneth','Michelle',
  'Kevin','Amanda','Brian','Melissa','George','Deborah','Timothy','Stephanie',
  'Ronald','Rebecca','Edward','Sharon','Jason','Laura','Jeffrey','Cynthia',
  'Ryan','Kathleen','Jacob','Amy','Gary','Angela','Nicholas','Shirley',
  'Eric','Anna','Jonathan','Brenda','Stephen','Pamela','Larry','Emma',
  'Justin','Nicole','Scott','Helen','Brandon','Samantha','Benjamin','Katherine',
  'Frank','Christine','Gregory','Debra','Raymond','Rachel','Samuel','Carolyn',
  'Patrick','Janet','Alexander','Catherine','Jack','Maria','Dennis','Heather',
  'Jerry','Diane','Tyler','Julie','Aaron','Joyce','Henry','Victoria',
  'Douglas','Kelly','Jose','Christina','Adam','Ruth','Peter','Joan'
]

const lastNames = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas',
  'Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White',
  'Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young',
  'Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell',
  'Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker',
  'Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy',
  'Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey',
  'Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson',
  'Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza',
  'Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers',
  'Long','Ross','Foster','Jimenez','Powell','Jenkins','Perry','Russell',
  'Sullivan','Bell','Coleman','Butler','Henderson','Barnes','Gonzales','Fisher'
]

const streetNames = [
  'Oak','Maple','Cedar','Pine','Elm','Main','Park','Lake','Hill','River',
  'Spring','Valley','Forest','Meadow','Sunset','Highland','Riverside','Lakeside',
  'Washington','Lincoln','Jefferson','Madison','Adams','Monroe','Jackson','Grant',
  'Sherman','Franklin','Sheridan','Wilson','Harrison','Tyler','Polk','Pierce',
  'Buchanan','Cleveland','McKinley','Harding','Coolidge','Hoover','Truman','Kennedy',
  'Johnson','Nixon','Ford','Carter','Reagan','Bush','Clinton','Obama',
  'Commerce','Market','Church','School','College','University','Academy','Liberty',
  'Union','State','Central','Broad','Division','Industrial','Railroad','Airport',
  'Summit','Ridge','Crest','Glen','Meadow','Prairie','Orchard','Garden',
  'Harbor','Bay','Shore','Beach','Ocean','Sea','Coral','Cypress'
]

const streetTypes = ['St','Ave','Blvd','Dr','Ln','Rd','Way','Pkwy','Ct','Pl','Ter','Loop']

const cities = [
  ['New York','NY','10001'],['Los Angeles','CA','90001'],['Chicago','IL','60601'],
  ['Houston','TX','77001'],['Phoenix','AZ','85001'],['Philadelphia','PA','19101'],
  ['San Antonio','TX','78201'],['San Diego','CA','92101'],['Dallas','TX','75201'],
  ['San Jose','CA','95101'],['Austin','TX','78701'],['Jacksonville','FL','32201'],
  ['Fort Worth','TX','76101'],['Columbus','OH','43201'],['Charlotte','NC','28201'],
  ['Indianapolis','IN','46201'],['San Francisco','CA','94101'],['Seattle','WA','98101'],
  ['Denver','CO','80201'],['Nashville','TN','37201'],['Oklahoma City','OK','73101'],
  ['El Paso','TX','79901'],['Washington','DC','20001'],['Boston','MA','02101'],
  ['Memphis','TN','38101'],['Louisville','KY','40201'],['Portland','OR','97201'],
  ['Las Vegas','NV','89101'],['Milwaukee','WI','53201'],['Albuquerque','NM','87101'],
  ['Tucson','AZ','85701'],['Fresno','CA','93701'],['Sacramento','CA','95801'],
  ['Mesa','AZ','85201'],['Atlanta','GA','30301'],['Omaha','NE','68101'],
  ['Colorado Springs','CO','80901'],['Raleigh','NC','27601'],['Long Beach','CA','90801'],
  ['Virginia Beach','VA','23450'],['Minneapolis','MN','55401'],['Tampa','FL','33601'],
  ['New Orleans','LA','70112'],['Arlington','TX','76001'],['Wichita','KS','67201'],
  ['Bakersfield','CA','93301'],['Aurora','CO','80010'],['Anaheim','CA','92801'],
  ['Santa Ana','CA','92701'],['Corpus Christi','TX','78401'],['Riverside','CA','92501'],
  ['Lexington','KY','40501'],['St. Louis','MO','63101'],['Pittsburgh','PA','15201'],
  ['Anchorage','AK','99501'],['Stockton','CA','95201'],['Cincinnati','OH','45201'],
  ['St. Paul','MN','55101'],['Greensboro','NC','27401'],['Toledo','OH','43601'],
  ['Newark','NJ','07101'],['Plano','TX','75023'],['Henderson','NV','89002'],
  ['Orlando','FL','32801'],['Chandler','AZ','85224'],['Laredo','TX','78040'],
  ['Madison','WI','53701'],['Durham','NC','27701'],['Lubbock','TX','79401'],
  ['Winston-Salem','NC','27101'],['Garland','TX','75040'],['Glendale','AZ','85301'],
  ['Hialeah','FL','33010'],['Reno','NV','89501'],['Baton Rouge','LA','70801'],
  ['Irvine','CA','92614'],['Chesapeake','VA','23320'],['Irving','TX','75061'],
  ['Scottsdale','AZ','85251'],['North Las Vegas','NV','89030'],['Fremont','CA','94536'],
  ['Gilbert','AZ','85233'],['San Bernardino','CA','92401'],['Birmingham','AL','35201'],
  ['Rochester','NY','14601'],['Richmond','VA','23218'],['Spokane','WA','99201'],
  ['Des Moines','IA','50301'],['Montgomery','AL','36101'],['Modesto','CA','95351'],
  ['Fayetteville','NC','28301'],['Tacoma','WA','98401'],['Shreveport','LA','71101'],
  ['Fontana','CA','92335'],['Moreno Valley','CA','92551'],['Glendale','CA','91201'],
  ['Akron','OH','44301'],['Yonkers','NY','10701'],['Columbus','GA','31901'],
  ['Augusta','GA','30901'],['Little Rock','AR','72201'],['Grand Rapids','MI','49501'],
  ['Huntington Beach','CA','92646'],['Salt Lake City','UT','84101'],['Tallahassee','FL','32301']
]

const companyWords1 = [
  'Apex','Blue','Bright','Core','Crown','Delta','Eagle','First','Global','Grand',
  'Great','Green','High','Iron','Key','Lead','Liberty','Metro','Nexus','North',
  'Nova','Open','Peak','Prime','Pro','Pure','Red','Ridge','Rock','Royal',
  'Silver','Smart','Solar','South','Star','Summit','Swift','Terra','Titan','True',
  'United','Urban','Venture','West','Zenith','Anchor','Arrow','Axis','Bay','Bold',
  'Bridge','Capital','Cascade','Cedar','Clear','Cloud','Coast','Compass','Crest','Crystal',
  'Dawn','Deep','Diamond','Drift','Dynamic','Edge','Elite','Empire','Evo','Falcon',
  'Field','Firm','Flame','Fleet','Forge','Fort','Forward','Fusion','Galaxy','Gate',
  'Haven','Hawk','Helix','Horizon','Hunter','Icon','Ideal','Impact','Infinity','Inland'
]

const companyWords2 = [
  'Solutions','Group','Partners','Systems','Technologies','Ventures','Capital','Holdings',
  'Services','Consulting','Analytics','Digital','Dynamics','Enterprises','Industries',
  'Innovations','Logistics','Management','Networks','Operations','Resources','Strategies',
  'Studios','Supply','Support','Works','Advisors','Agency','Alliance','Associates',
  'Brands','Bridge','Bureau','Center','Circle','Collective','Commerce','Connect',
  'Data','Design','Development','Distribution','Division','Exchange','Financial',
  'Foundation','Global','Growth','Hub','Intelligence','International','Investments',
  'Labs','Media','Metrics','Mobility','Platform','Portfolio','Process','Products',
  'Properties','Research','Search','Security','Source','Space','Spectrum','Trade',
  'Transit','Trust','Value','Vision','Web','Wireless','Cloud','Stream','Force','Edge'
]

const companySuffixes = ['LLC','Inc','Corp','Co','Ltd','Group','Partners','Associates','']

// ── generators ────────────────────────────────────────────────────────────────

function pick(arr) { return arr[randomInt(arr.length)] }

function phone() {
  const area   = randomInt(200, 1000).toString().padStart(3, '0')
  const prefix = randomInt(200, 1000).toString().padStart(3, '0')
  const line   = randomInt(0, 10000).toString().padStart(4, '0')
  return `(${area}) ${prefix}-${line}`
}

function address() {
  const num    = randomInt(1, 9999)
  const street = pick(streetNames)
  const type   = pick(streetTypes)
  const [city, state, zip] = pick(cities)
  return { street: `${num} ${street} ${type}`, city, state, zip }
}

function user(i) {
  const first = pick(firstNames)
  const last  = pick(lastNames)
  const addr  = address()
  return {
    id: i + 1,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    phone: phone(),
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip
  }
}

function company(i) {
  const w1   = pick(companyWords1)
  const w2   = pick(companyWords2)
  const suf  = pick(companySuffixes)
  const name = suf ? `${w1} ${w2} ${suf}` : `${w1} ${w2}`
  const addr = address()
  return {
    id: i + 1,
    company_name: name,
    phone: phone(),
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip
  }
}

// ── build users ───────────────────────────────────────────────────────────────

console.log('Generating users...')
const users = []
for (let i = 0; i < RECORDS; i++) users.push(user(i))

// ── build companies with deliberate overlaps ──────────────────────────────────

console.log('Generating companies...')
const companies = []
for (let i = 0; i < RECORDS; i++) {
  const c = company(i)

  if (i < PHONE_MATCHES) {
    // match phone of user i
    c.phone = users[i].phone
  }

  if (i >= PHONE_MATCHES && i < PHONE_MATCHES + ADDR_MATCHES) {
    // match address of user i
    const u = users[i]
    c.street = u.street
    c.city   = u.city
    c.state  = u.state
    c.zip    = u.zip
  }

  companies.push(c)
}

// ── write CSVs ────────────────────────────────────────────────────────────────

function writeCsv(filename, headers, rows) {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(filename)
    ws.on('error', reject)
    ws.on('finish', resolve)
    ws.write(headers.join(',') + '\n')
    for (const row of rows) {
      ws.write(headers.map(h => row[h]).join(',') + '\n')
    }
    ws.end()
  })
}

const userHeaders    = ['id','first_name','last_name','email','phone','street','city','state','zip']
const companyHeaders = ['id','company_name','phone','street','city','state','zip']

console.log('Writing users.csv...')
await writeCsv('users.csv', userHeaders, users)

console.log('Writing companies.csv...')
await writeCsv('companies.csv', companyHeaders, companies)

console.log('Done.')
console.log(`  users.csv    — ${RECORDS.toLocaleString()} rows`)
console.log(`  companies.csv — ${RECORDS.toLocaleString()} rows`)
console.log(`  Phone matches : rows 1–${PHONE_MATCHES.toLocaleString()} of companies → users`)
console.log(`  Address matches: rows ${(PHONE_MATCHES+1).toLocaleString()}–${(PHONE_MATCHES+ADDR_MATCHES).toLocaleString()} of companies → users`)
