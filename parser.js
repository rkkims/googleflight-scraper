import * as cheerio from 'cheerio'
import fs from 'fs'

export function parseSearchFlights (html) {
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

/**
 * Parse a Google Flights booking page (flight details + booking options)
 * @param {string} html - Full booking page HTML
 * @returns {{flights: Array<{segments: Array, booking_options: Array}>}}
 */
export function parseBookingFlights (html) {
  const $ = cheerio.load(html)
  const flights = []

  $('div[jsname="IWWDBc"], div[jsname="YdtKid"]').each((_, block) => {
    // --- Extract flight segments from data-travelimpactmodelwebsiteurl
    const url =
      $(block)
        .find('[data-travelimpactmodelwebsiteurl]')
        .attr('data-travelimpactmodelwebsiteurl') ||
      $(block).find('div.NZRfve').attr('data-travelimpactmodelwebsiteurl')

    const segments = []
    if (url) {
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
    }

    // --- Extract booking options
    const bookingOptions = []
    $(block)
      .find('div[jsname="I4U2pc"] a, a[href*="/travel/flights/redirect"]')
      .each((_, el) => {
        const option = {}
        option.name = $(el).find('.ogfYpf').text().trim() || $(el).text().trim()
        option.url = $(el).attr('href')?.trim() || null
        if (option.url) {
          if (option.url.includes('airline')) option.direct = true
          else if (/redirect/.test(option.url)) option.direct = false
          bookingOptions.push(option)
        }
      })

    if (segments.length && bookingOptions.length) {
      flights.push({
        segments,
        booking_options: bookingOptions
      })
    }
  })

  return { flights }
}

if (process.argv[1].endsWith('parser.js')) {
  const html = fs.readFileSync('./output.html', 'utf8')
  const result = parseBookingFlights(html)
  fs.writeFileSync('./flights_with_prices.json', JSON.stringify(result, null, 2))
  console.log(
    `✅ ${result.flights.length} flights and prices saved to flights_with_prices.json`
  )
}
