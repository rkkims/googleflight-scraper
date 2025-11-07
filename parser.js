import * as cheerio from 'cheerio'
import fs from 'fs'

export function parseFlights (html) {
  const $ = cheerio.load(html)
  const flights = []

  $('div[jsname="IWWDBc"], div[jsname="YdtKid"]').each((i, block) => {
    const isBest = i === 0
    $(block)
      .find('ul.Rk10dc li')
      .each((_, li) => {
        const url =
          $(li)
            .find('[data-travelimpactmodelwebsiteurl]')
            .attr('data-travelimpactmodelwebsiteurl') ||
          $(li).find('div.NZRfve').attr('data-travelimpactmodelwebsiteurl')
        if (!url) return

        const segments = []
        try {
          const p = new URL(url).searchParams.get('itinerary')?.split(',') || []
          for (const seg of p) {
            const [o, d, al, fn, date] = seg.split('-')
            if (date)
              segments.push({
                origin: o,
                destination: d,
                airline_code: al,
                flight_number: fn,
                flight_date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
              })
          }
        } catch {}
        if (segments.length) flights.push({ is_best: isBest, segments })
      })
  })

  const unique = []
  const seen = new Map()
  for (const f of flights) {
    const k = JSON.stringify(f.segments)
    if (!seen.has(k) || (f.is_best && !seen.get(k).is_best)) seen.set(k, f)
  }
  unique.push(...seen.values())

  return { flights: unique }
}

if (process.argv[1].endsWith('parser.js')) {
  const html = fs.readFileSync('./output.html', 'utf8')
  const result = parseFlights(html)
  fs.writeFileSync('./flights.json', JSON.stringify(result, null, 2))
  console.log(
    `✅ ${result.flights.length} unique flights saved to flights.json`
  )
}
