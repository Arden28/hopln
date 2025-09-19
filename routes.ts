export interface Agency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string;
  agency_phone: string;
  agency_email: string;
}

export const agencies: Agency[] = [
  {
    agency_id: "UON",
    agency_name: "University of Nairobi Shuttle Service",
    agency_url: "https://uonbi.ac.ke",
    agency_timezone: "Africa/Nairobi",
    agency_lang: "EN",
    agency_phone: "+254 20 491 0000",
    agency_email: ""
  },
  {
    agency_id: "Koverae",
    agency_name: "Koverae Technologies Ltd",
    agency_url: "https://koverae.com",
    agency_timezone: "Africa/Nairobi",
    agency_lang: "EN",
    agency_phone: "+254 20 491 0000",
    agency_email: ""
  }
];

export interface Route {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
}

export const routes: Route[] = [
  {
    route_id: "10000107D11",
    agency_id: "UON",
    route_short_name: "107D",
    route_long_name: "Ruaka-Ruiru",
    route_type: 3
  },
  {
    route_id: "10000114011",
    agency_id: "UON",
    route_short_name: "114R",
    route_long_name: "Ngara-Rwaka-Ndenderu-Limuru",
    route_type: 3
  },
  {
    route_id: "10000116011",
    agency_id: "UON",
    route_short_name: "116",
    route_long_name: "Koja-Ngara-Banana-Limuru",
    route_type: 3
  },
  {
    route_id: "10100011A11",
    agency_id: "UON",
    route_short_name: "11A",
    route_long_name: "Odeon-Aga Khan-Highridge",
    route_type: 3
  },
  {
    route_id: "10200010811",
    agency_id: "UON",
    route_short_name: "108",
    route_long_name: "UN-New Muthaiga-Gachie-Gichagi",
    route_type: 3
  },
  {
    route_id: "10300011F11",
    agency_id: "UON",
    route_short_name: "11B",
    route_long_name: "Odeon-UN-Ruaka",
    route_type: 3
  },
  {
    route_id: "10300106011",
    agency_id: "UON",
    route_short_name: "106",
    route_long_name: "Koja-UN-Ruaka-Banana",
    route_type: 3
  },
  {
    route_id: "10400010711",
    agency_id: "UON",
    route_short_name: "107",
    route_long_name: "Odeon-UN-Ruaka-Ndenderu",
    route_type: 3
  },
  {
    route_id: "20000002311",
    agency_id: "UON",
    route_short_name: "23W",
    route_long_name: "Nation Building-Museum Hill-Graffins College-Westlands",
    route_type: 3
  },
  {
    route_id: "20000004511",
    agency_id: "UON",
    route_short_name: "45K",
    route_long_name: "Odeon-Pangani-Roysabu-Githurai-KU",
    route_type: 3
  },
  {
    route_id: "20000004512",
    agency_id: "UON",
    route_short_name: "45G",
    route_long_name: "Munyu Road-Pangani-Roysabu-Githurai",
    route_type: 3
  },
  {
    route_id: "20000004513",
    agency_id: "UON",
    route_short_name: "45P",
    route_long_name: "Githurai-Proggie",
    route_type: 3
  },
  {
    route_id: "20000145011",
    agency_id: "UON",
    route_short_name: "145",
    route_long_name: "Munyu Road-Pangani-Roysambu-Githurai-KU-Ruiru",
    route_type: 3
  },
  {
    route_id: "20000237011",
    agency_id: "UON",
    route_short_name: "237",
    route_long_name: "Munyu Road-Pangani-Roysabu-Githurai-KU-Ruiru-Juja-Thika",
    route_type: 3
  },
  {
    route_id: "20100010011",
    agency_id: "UON",
    route_short_name: "100",
    route_long_name: "O.T.C-Pangani-Muthaiga Roundabout-Kiambu Road-Kiambu Institute-Kiambu",
    route_type: 3
  },
  {
    route_id: "20100012011",
    agency_id: "UON",
    route_short_name: "120",
    route_long_name: "Kaka-Pangani-Muthaiga Roundabout-Kiambu Road-Kiambu Institute-Kiambu-Githunguri",
    route_type: 3
  },
  {
    route_id: "20100012111",
    agency_id: "UON",
    route_short_name: "121",
    route_long_name: "Kaka-Pangani-Muthaiga Roundabout-Kiambu Road-Kiambu Institute-Kiambu-Ndumberi",
    route_type: 3
  },
  {
    route_id: "20100100A11",
    agency_id: "UON",
    route_short_name: "100A",
    route_long_name: "Ngara-Pangani-Muthaiga Roundabout-Kiambu Road-Kiambu Institute-Kiambu Hospital",
    route_type: 3
  },
  {
    route_id: "20101007700",
    agency_id: "UON",
    route_short_name: "0027",
    route_long_name: "Kariobangi North - Thika road - Town",
    route_type: 3
  },
  {
    route_id: "20104003910",
    agency_id: "UON",
    route_short_name: "0039",
    route_long_name: "Bypass Ruiru, City Cabanas",
    route_type: 3
  },
  {
    route_id: "20400005311",
    agency_id: "UON",
    route_short_name: "53",
    route_long_name: "Roasters-Thome-Maruirui",
    route_type: 3
  },
  {
    route_id: "20700145D01",
    agency_id: "UON",
    route_short_name: "145D",
    route_long_name: "Torrents-Membley-Ruiru",
    route_type: 3
  },
  {
    route_id: "20701293011",
    agency_id: "UON",
    route_short_name: "29/30",
    route_long_name: "Ngara-Pangani-Alssops-Drive in-Mathare",
    route_type: 3
  },
  {
    route_id: "20702000611",
    agency_id: "UON",
    route_short_name: "6",
    route_long_name: "Koja-Pangani Flyover-Guru Nanak-Pangani Girls High School-Mlango-Eastleigh",
    route_type: 3
  },
  {
    route_id: "20800203001",
    agency_id: "UON",
    route_short_name: "2030",
    route_long_name: "Allsops-Rounda",
    route_type: 3
  },
  {
    route_id: "20801002511",
    agency_id: "UON",
    route_short_name: "25",
    route_long_name: "Odeon-Pangani-Alssops-Baba Dogo",
    route_type: 3
  },
  {
    route_id: "20801025A11",
    agency_id: "UON",
    route_short_name: "25A",
    route_long_name: "Odeon-Pangani-Alssops-Baba Dogo-Lucky Summer",
    route_type: 3
  },
  {
    route_id: "20807042011",
    agency_id: "UON",
    route_short_name: "42",
    route_long_name: "Allsops-Rounda-Dandora",
    route_type: 3
  },
  {
    route_id: "20901043011",
    agency_id: "UON",
    route_short_name: "43",
    route_long_name: "Bus Station-Pangani-Allsops-Ngumba",
    route_type: 3
  },
  {
    route_id: "21000004911",
    agency_id: "UON",
    route_short_name: "49",
    route_long_name: "Odeon-Pangani-Roysambu-Kasarani-Sunton",
    route_type: 3
  },
  {
    route_id: "21000017B11",
    agency_id: "UON",
    route_short_name: "17B",
    route_long_name: "Bus Station-Pangani-Roysambu-Kasarani-Mwiki",
    route_type: 3
  },
  {
    route_id: "21100004411",
    agency_id: "UON",
    route_short_name: "44G",
    route_long_name: "Odeon-Pangani-Roysambu-Githurai-KU",
    route_type: 3
  },
  {
    route_id: "21100004412",
    agency_id: "UON",
    route_short_name: "44Z",
    route_long_name: "Odeon-Pangani-Roysambu-Zimmerman-KU",
    route_type: 3
  },
  {
    route_id: "21100004421",
    agency_id: "UON",
    route_short_name: "44K",
    route_long_name: "Roysambu-Githurai-KU",
    route_type: 3
  },
  {
    route_id: "21200017B12",
    agency_id: "UON",
    route_short_name: "17B_2",
    route_long_name: "Roysambu-Sunton-Kasarani-Mwiki",
    route_type: 3
  },
  {
    route_id: "30000004611",
    agency_id: "UON",
    route_short_name: "46H",
    route_long_name: "Ronald Ngala-Juja Road-Eastleigh-Huruma",
    route_type: 3
  },
  {
    route_id: "30000046B11",
    agency_id: "UON",
    route_short_name: "46B",
    route_long_name: "Ronald Ngala-Juja Road-Eastleigh-Rounda",
    route_type: 3
  },
  {
    route_id: "30007004111",
    agency_id: "UON",
    route_short_name: "41",
    route_long_name: "Gikomba-Rounda-Dandora",
    route_type: 3
  },
  {
    route_id: "30100000711",
    agency_id: "UON",
    route_short_name: "7",
    route_long_name: "Town-Kariokor DC-Gikomba",
    route_type: 3
  },
  {
    route_id: "30100011C11",
    agency_id: "UON",
    route_short_name: "11C",
    route_long_name: "Odeon-Pangani Flyover-Pangani Girls High School-Mlango-Pangani Terminus",
    route_type: 3
  },
  {
    route_id: "30101000311",
    agency_id: "UON",
    route_short_name: "3N",
    route_long_name: "Gikomba-Kariokor-Ngara",
    route_type: 3
  },
  {
    route_id: "30600017A11",
    agency_id: "UON",
    route_short_name: "17Aky",
    route_long_name: "EastLeigh-Rounda-Umoja 2-Kayole",
    route_type: 3
  },
  {
    route_id: "30600018C11",
    agency_id: "UON",
    route_short_name: "18C",
    route_long_name: "Eastleigh-Rounda-Dandora-Kayole",
    route_type: 3
  },
  {
    route_id: "30600186211",
    agency_id: "UON",
    route_short_name: "16/62",
    route_long_name: "Bus Station-Rounda-Dandora-Kayole",
    route_type: 3
  },
  {
    route_id: "30603373812",
    agency_id: "UON",
    route_short_name: "3738",
    route_long_name: "Rounda-Saika-Ruai",
    route_type: 3
  },
  {
    route_id: "30800001411",
    agency_id: "UON",
    route_short_name: "14",
    route_long_name: "Ronald Ngala-Juja Road-Eastleigh-Huruma-Kariobangi",
    route_type: 3
  },
  {
    route_id: "30800002811",
    agency_id: "UON",
    route_short_name: "28",
    route_long_name: "Gikomba-Eastleigh-Huruma-Kariobangi",
    route_type: 3
  },
  {
    route_id: "30907003211",
    agency_id: "UON",
    route_short_name: "32D",
    route_long_name: "OTC-Kariokor-Mlango-Rounda-Dandora",
    route_type: 3
  },
  {
    route_id: "40100003311",
    agency_id: "UON",
    route_short_name: "33DP",
    route_long_name: "Muthurwa-Donholm-Pipeline",
    route_type: 3
  },
  {
    route_id: "40101040501",
    agency_id: "UON",
    route_short_name: "405",
    route_long_name: "City Stadium-Nyayo Stadium",
    route_type: 3
  },
  {
    route_id: "40102040511",
    agency_id: "UON",
    route_short_name: "69",
    route_long_name: "Muthurwa-Hillocks-GM",
    route_type: 3
  },
  {
    route_id: "40200000601",
    agency_id: "UON",
    route_short_name: "6E",
    route_long_name: "Church Army-Biafra-Joster",
    route_type: 3
  },
  {
    route_id: "40201002311",
    agency_id: "UON",
    route_short_name: "23KS",
    route_long_name: "Gill House-Jogoo Road-Shauri Moyo-Jerusalem-Buruburu-Kariobangi South",
    route_type: 3
  },
  {
    route_id: "40301707111",
    agency_id: "UON",
    route_short_name: "70/71",
    route_long_name: "Muthurwa-Likoni-Sinai-Lunga Lunga",
    route_type: 3
  },
  {
    route_id: "40401001011",
    agency_id: "UON",
    route_short_name: "10",
    route_long_name: "Muthurwa-Makadara-Maringo",
    route_type: 3
  },
  {
    route_id: "40403002611",
    agency_id: "UON",
    route_short_name: "26S",
    route_long_name: "Aquinas-Jerusalem-Outering-Kariobangi",
    route_type: 3
  },
  {
    route_id: "40501002611",
    agency_id: "UON",
    route_short_name: "26",
    route_long_name: "Makadara-Harambee-Outering-Kariobangi",
    route_type: 3
  },
  {
    route_id: "40601003611",
    agency_id: "UON",
    route_short_name: "36",
    route_long_name: "City Stadium-Buruburu-Kwa Mbao-Dandora",
    route_type: 3
  },
  {
    route_id: "40601005811",
    agency_id: "UON",
    route_short_name: "58",
    route_long_name: "Ambassadeur-Jogoo Road-Buruburu",
    route_type: 3
  },
  {
    route_id: "40700003311",
    agency_id: "UON",
    route_short_name: "33DC",
    route_long_name: "Donholm-Rounda-Carbanas",
    route_type: 3
  },
  {
    route_id: "40700003411",
    agency_id: "UON",
    route_short_name: "34J",
    route_long_name: "Ambassadeur-Donholm-Rounda-JKIA",
    route_type: 3
  },
  {
    route_id: "40700033C11",
    agency_id: "UON",
    route_short_name: "33C",
    route_long_name: "Commercial-Jogoo Road-Pipeline-Cabanas",
    route_type: 3
  },
  {
    route_id: "40701003311",
    agency_id: "UON",
    route_short_name: "33GTB",
    route_long_name: "Accra Road-Jogoo Road-Donholm-Fedha-Gate B",
    route_type: 3
  },
  {
    route_id: "40702002001",
    agency_id: "UON",
    route_short_name: "20",
    route_long_name: "Mama Lucy Hospital-Kayole-Njiru-Mwiki",
    route_type: 3
  },
  {
    route_id: "40702034B11",
    agency_id: "UON",
    route_short_name: "34B",
    route_long_name: "Ambassadeur-Donholm-Jacaranda",
    route_type: 3
  },
  {
    route_id: "40702196111",
    agency_id: "UON",
    route_short_name: "1961K",
    route_long_name: "Landhies Road-Jogoo Road-Jacaranda-Kayole",
    route_type: 3
  },
  {
    route_id: "40702196112",
    agency_id: "UON",
    route_short_name: "1961Kd",
    route_long_name: "Caltex Donholm-Jacaranda-Kayole",
    route_type: 3
  },
  {
    route_id: "40703196011",
    agency_id: "UON",
    route_short_name: "1960",
    route_long_name: "OTC-Donholm-Kayole",
    route_type: 3
  },
  {
    route_id: "40704356001",
    agency_id: "UON",
    route_short_name: "3560_2",
    route_long_name: "Donholm-Mutindwa-Umoja 2",
    route_type: 3
  },
  {
    route_id: "40704356011",
    agency_id: "UON",
    route_short_name: "35/60",
    route_long_name: "Town-Donholm-Umoja",
    route_type: 3
  },
  {
    route_id: "4070500SK11",
    agency_id: "UON",
    route_short_name: "39SK",
    route_long_name: "Ronald Ngala-Jogoo Road-Kangundo Road-Saika-Kayole Junction",
    route_type: 3
  },
  {
    route_id: "40705017A01",
    agency_id: "UON",
    route_short_name: "17A",
    route_long_name: "Rounda-Umoja 2-Kayole",
    route_type: 3
  },
  {
    route_id: "40705019C11",
    agency_id: "UON",
    route_short_name: "19Cdc",
    route_long_name: "Ambassadeur-Jogoo Road-Donholm-Caltex-Komarocks",
    route_type: 3
  },
  {
    route_id: "4070519C211",
    agency_id: "UON",
    route_short_name: "19C2",
    route_long_name: "Donholm-Caltex-Komarocks",
    route_type: 3
  },
  {
    route_id: "40705383911",
    agency_id: "UON",
    route_short_name: "38/39",
    route_long_name: "Town-Donholm-Njiru-Ruai",
    route_type: 3
  },
  {
    route_id: "50000002412",
    agency_id: "UON",
    route_short_name: "24BK",
    route_long_name: "Bomas-Karen Hospital-Karen",
    route_type: 3
  },
  {
    route_id: "50100001111",
    agency_id: "UON",
    route_short_name: "11",
    route_long_name: "Bus Station-Industrial Area-South B-Hazina",
    route_type: 3
  },
  {
    route_id: "50100001121",
    agency_id: "UON",
    route_short_name: "11_2",
    route_long_name: "Town-Industrial Area-Mater-Railways Training Institute-Balozi-Hazina",
    route_type: 3
  },
  {
    route_id: "50201014A11",
    agency_id: "UON",
    route_short_name: "14A",
    route_long_name: "Bus Station-Nairobi West-Madaraka-Strathmore",
    route_type: 3
  },
  {
    route_id: "50201014B11",
    agency_id: "UON",
    route_short_name: "14B",
    route_long_name: "Bus Station-Nairobi West-TMall",
    route_type: 3
  },
  {
    route_id: "50203001611",
    agency_id: "UON",
    route_short_name: "16",
    route_long_name: "Bus Station-Nyayo Stadium-T Mall-Highrise",
    route_type: 3
  },
  {
    route_id: "50204001511",
    agency_id: "UON",
    route_short_name: "15",
    route_long_name: "Bus Station-Nyayo Stadium-Wilson-Langata",
    route_type: 3
  },
  {
    route_id: "50205012511",
    agency_id: "UON",
    route_short_name: "125",
    route_long_name: "Railways-Langata Road-Bomas-Ongata Rongai",
    route_type: 3
  },
  {
    route_id: "50205012601",
    agency_id: "UON",
    route_short_name: "126RK",
    route_long_name: "Ongata Rongai-Nkoroi-Kiserian",
    route_type: 3
  },
  {
    route_id: "50205012611",
    agency_id: "UON",
    route_short_name: "126",
    route_long_name: "Railways-Langata Road-Ongata Rongai-Kiserian",
    route_type: 3
  },
  {
    route_id: "50206002411",
    agency_id: "UON",
    route_short_name: "24",
    route_long_name: "Ambassadeur-Nyayo Stadium-Bomas-Hardy-Karen",
    route_type: 3
  },
  {
    route_id: "50300012C11",
    agency_id: "UON",
    route_short_name: "12C",
    route_long_name: "Bus Station-Red Cross-Mugoya",
    route_type: 3
  },
  {
    route_id: "50301012D11",
    agency_id: "UON",
    route_short_name: "12D",
    route_long_name: "Bus Station-Red Cross-KPA-College Of Insurance-Amboseli",
    route_type: 3
  },
  {
    route_id: "50600003311",
    agency_id: "UON",
    route_short_name: "33IMR",
    route_long_name: "Commercial-Belleview-Imara Daima",
    route_type: 3
  },
  {
    route_id: "50600033A11",
    agency_id: "UON",
    route_short_name: "33MKR",
    route_long_name: "Bus Station-Mombasa Road-Imara Daima-St.Bakhita",
    route_type: 3
  },
  {
    route_id: "50700003311",
    agency_id: "UON",
    route_short_name: "33UTW",
    route_long_name: "Utawala-Ambassadeur",
    route_type: 3
  },
  {
    route_id: "50700014501",
    agency_id: "UON",
    route_short_name: "145B",
    route_long_name: "Bypass-Ruiru Ndani-Ruiru",
    route_type: 3
  },
  {
    route_id: "50700033H01",
    agency_id: "UON",
    route_short_name: "33H",
    route_long_name: "Cabanas-Utawala-Bypass",
    route_type: 3
  },
  {
    route_id: "50701003311",
    agency_id: "UON",
    route_short_name: "33TP",
    route_long_name: "Commercial-Mombasa Road-Taj Mall-Pipeline",
    route_type: 3
  },
  {
    route_id: "50702003311",
    agency_id: "UON",
    route_short_name: "33FED",
    route_long_name: "Commercial-Cabanas-Tuskys-Village-Gate A-Posta",
    route_type: 3
  },
  {
    route_id: "50703033C11",
    agency_id: "UON",
    route_short_name: "33B",
    route_long_name: "Commercial-Cabanas-Baraka",
    route_type: 3
  },
  {
    route_id: "50703033J01",
    agency_id: "UON",
    route_short_name: "33J",
    route_long_name: "Cabanas-Utawala-Githunguri",
    route_type: 3
  },
  {
    route_id: "50800011011",
    agency_id: "UON",
    route_short_name: "110",
    route_long_name: "Railways-Mombasa Road-Mlolongo-Kitengela",
    route_type: 3
  },
  {
    route_id: "50901011011",
    agency_id: "UON",
    route_short_name: "110ATH",
    route_long_name: "Railways-Mombasa Road-Devki-Makadara",
    route_type: 3
  },
  {
    route_id: "50901011012",
    agency_id: "UON",
    route_short_name: "110AK",
    route_long_name: "Athi River-Makadara-Kitengela",
    route_type: 3
  },
  {
    route_id: "60000004611",
    agency_id: "UON",
    route_short_name: "46Y",
    route_long_name: "Kencom-Valley Road-Hurlinghum-Yaya Centre",
    route_type: 3
  },
  {
    route_id: "60101007C11",
    agency_id: "UON",
    route_short_name: "7C",
    route_long_name: "Kencom-Community-Equity Center-Kenyatta National Hospital",
    route_type: 3
  },
  {
    route_id: "60200004611",
    agency_id: "UON",
    route_short_name: "46K",
    route_long_name: "Kencom-Valley Road-Yaya Centre-Kawangware",
    route_type: 3
  },
  {
    route_id: "60201005611",
    agency_id: "UON",
    route_short_name: "56",
    route_long_name: "Town-Yaya-Congo-Kanungaga",
    route_type: 3
  },
  {
    route_id: "70000000311",
    agency_id: "UON",
    route_short_name: "3U/3",
    route_long_name: "Dagoretti Corner-Naivasha Road-Uthiru",
    route_type: 3
  },
  {
    route_id: "70000010311",
    agency_id: "UON",
    route_short_name: "103",
    route_long_name: "Dagoretti Market-Uthiru-Kinoo-Wangige",
    route_type: 3
  },
  {
    route_id: "70000012911",
    agency_id: "UON",
    route_short_name: "129",
    route_long_name: "Kikuyu-Magu-Kingeero-Wangige",
    route_type: 3
  },
  {
    route_id: "70000203311",
    agency_id: "UON",
    route_short_name: "33NG",
    route_long_name: "Racecourse Road-Ngong Road-KNH-Ngumo",
    route_type: 3
  },
  {
    route_id: "70100203411",
    agency_id: "UON",
    route_short_name: "34L",
    route_long_name: "Kenyatta National Hospital-Mbagathi Road-Wilson Airport-Langata",
    route_type: 3
  },
  {
    route_id: "70101013301",
    agency_id: "UON",
    route_short_name: "33SB",
    route_long_name: "Ngumo-Highrise-Nairobi West-Couth C-South B",
    route_type: 3
  },
  {
    route_id: "70200000811",
    agency_id: "UON",
    route_short_name: "8",
    route_long_name: "Railways-Ngong Road-Kibera",
    route_type: 3
  },
  {
    route_id: "70200003211",
    agency_id: "UON",
    route_short_name: "32A",
    route_long_name: "Kencom-Community-KNH-Ngong Road-Ayani",
    route_type: 3
  },
  {
    route_id: "70201024C11",
    agency_id: "UON",
    route_short_name: "24C",
    route_long_name: "Kencom-Valley Road-Ngong Road-Karen-Hardy",
    route_type: 3
  },
  {
    route_id: "70301000511",
    agency_id: "UON",
    route_short_name: "5",
    route_long_name: "Town-Kenyatta-Adams-Jamhuri",
    route_type: 3
  },
  {
    route_id: "70400011111",
    agency_id: "UON",
    route_short_name: "111",
    route_long_name: "Railways-Ngong Road-Karen-Ngong",
    route_type: 3
  },
  {
    route_id: "70400012611",
    agency_id: "UON",
    route_short_name: "126N",
    route_long_name: "Ngong-Kiserian",
    route_type: 3
  },
  {
    route_id: "70401000111",
    agency_id: "UON",
    route_short_name: "1",
    route_long_name: "Karen-Karinde-Dagoretti Market",
    route_type: 3
  },
  {
    route_id: "70500004W11",
    agency_id: "UON",
    route_short_name: "4W",
    route_long_name: "Railways-Ngong Road-Wanyee-Kaberia",
    route_type: 3
  },
  {
    route_id: "70600010211",
    agency_id: "UON",
    route_short_name: "102",
    route_long_name: "Railways-NgongRoad-Kawangware-Kikuyu",
    route_type: 3
  },
  {
    route_id: "70601000211",
    agency_id: "UON",
    route_short_name: "2",
    route_long_name: "Railways-Ngong Road-Kawangware-Dagoretti Market",
    route_type: 3
  },
  {
    route_id: "70805046P10",
    agency_id: "UON",
    route_short_name: "046P",
    route_long_name: "Ambassadeur,Kabete,Kawangware",
    route_type: 3
  },
  {
    route_id: "70904004810",
    agency_id: "UON",
    route_short_name: "0048",
    route_long_name: "Yaya-Kasuku-Westlands",
    route_type: 3
  },
  {
    route_id: "80000002311",
    agency_id: "UON",
    route_short_name: "23KG",
    route_long_name: "Odeon-Chiromo-Westlands-Kangemi",
    route_type: 3
  },
  {
    route_id: "80000011911",
    agency_id: "UON",
    route_short_name: "119",
    route_long_name: "Koja-Westgate-Wangige",
    route_type: 3
  },
  {
    route_id: "80000114011",
    agency_id: "UON",
    route_short_name: "114W",
    route_long_name: "Ngara-Westlands-Kangemi-Limuru",
    route_type: 3
  },
  {
    route_id: "80000115011",
    agency_id: "UON",
    route_short_name: "115",
    route_long_name: "Koja-Westlands-Kangemi-Limuru",
    route_type: 3
  },
  {
    route_id: "80000119A11",
    agency_id: "UON",
    route_short_name: "119A",
    route_long_name: "Town-Westlands-Peponi Road-Spring Valley-ISK-Gathiga",
    route_type: 3
  },
  {
    route_id: "80000135011",
    agency_id: "UON",
    route_short_name: "135",
    route_long_name: "Kaka-Westlands-Kangemi-Limuru",
    route_type: 3
  },
  {
    route_id: "80100011811",
    agency_id: "UON",
    route_short_name: "118",
    route_long_name: "Koja-Westlands-Kabete-Wangige",
    route_type: 3
  },
  {
    route_id: "80100048A11",
    agency_id: "UON",
    route_short_name: "48A",
    route_long_name: "Odeon-Chiromo-Strathmore School-Lavington",
    route_type: 3
  },
  {
    route_id: "80101004811",
    agency_id: "UON",
    route_short_name: "48O",
    route_long_name: "Odeon-Chiromo-Kileleshwa-Othaya Road",
    route_type: 3
  },
  {
    route_id: "80101048B11",
    agency_id: "UON",
    route_short_name: "48B",
    route_long_name: "Odeon-Chiromo-Westlands Bypass-Methodist Guesthouse-Othaya Road",
    route_type: 3
  },
  {
    route_id: "80200004811",
    agency_id: "UON",
    route_short_name: "48K",
    route_long_name: "Westlands-ABC Place-Lavington-Kawangware",
    route_type: 3
  },
  {
    route_id: "80200048C11",
    agency_id: "UON",
    route_short_name: "48C",
    route_long_name: "Odeon-Chiromo-Westlands-ByPass-Yaya",
    route_type: 3
  },
  {
    route_id: "80400003011",
    agency_id: "UON",
    route_short_name: "30",
    route_long_name: "Odeon-Westlands-Kangemi-Uthiru",
    route_type: 3
  },
  {
    route_id: "80500010511",
    agency_id: "UON",
    route_short_name: "105",
    route_long_name: "Odeon-Westlands-Kangemi-Kinoo-Regen-Kikuyu",
    route_type: 3
  }
];