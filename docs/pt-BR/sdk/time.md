# Tempo do mundo e calendários (`Loom.time`)

O mundo tem um único relógio. O servidor conta **segundos do mundo** e continua contando sozinho enquanto o mundo não estiver pausado; cada cliente calcula o horário atual a partir do último snapshot que recebeu, então `Loom.time.now` está sempre atualizado sem uma mensagem a cada segundo. Um **calendário** é dado puro que transforma esses segundos em uma data e vice-versa.

```js
Loom.time.now;                 // segundos do mundo, avançam sozinhos
Loom.time.formatDate();        // ex.: "Sunday, 1 Frostmoon 1200 TM"
await Loom.time.advance(3600); // GM: pula uma hora
```

## Como o relógio se comporta

- O relógio roda na memória do servidor e é salvo no mundo a cada minuto e em toda mudança. Uma queda do servidor perde no máximo o último minuto.
- **Pausar o mundo pausa o relógio**; retomar o reinicia. Um mundo aberto com launch sempre começa pausado, então o relógio começa parado.
- O relógio continua rodando durante o combate. Durações por turno são uma contagem separada (ver a documentação de efeitos).
- `timeScale` é quantos segundos do mundo passam por segundo real (padrão `1`; um GM pode aumentá-lo, por exemplo para viagens). O limite é 100000.
- O horário do mundo é um inteiro com sinal. Os valores são guardados como inteiros de 64 bits, então um calendário com um ano real (como 1492) cabe.

## Lendo o relógio

| Membro | Tipo | Descrição |
|--------|------|-----------|
| `Loom.time.now` | `number` | Horário atual do mundo em segundos (interpolado, roda sozinho). |
| `Loom.time.worldTime` | `number` | Mesmo valor de `now` (nome mais antigo, mantido por compatibilidade). |
| `Loom.time.scale` | `number` | Segundos do mundo por segundo real. |
| `Loom.time.paused` | `boolean` | `true` enquanto o mundo estiver pausado. |
| `Loom.time.calendar` | `CalendarDef` | Calendário que o mundo usa (cai para o Gregoriano quando o id é desconhecido). |
| `Loom.time.calendars` | registro | Registro de calendários: `register(def)` (retorna a lista de problemas), `get(id)` e `getAll()`. Ver abaixo. |
| `Loom.time.date(seconds?)` | `CalendarDate` | A data do calendário de um horário do mundo (padrão: agora). |
| `Loom.time.formatDate(seconds?)` | `string` | A data escrita com o template `format` do calendário. |
| `Loom.time.addDuration(start, amount, unit)` | `number` | Horário do mundo `amount` unidades depois de `start`. `unit` é `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` ou `years`. Meses e anos seguem o calendário (mantendo o dia, limitado ao tamanho do mês). Um `amount` negativo ou inválido conta como 0. |

`Loom.time.earthCalendar` é o helper mais antigo, sem mudanças, com anos fixos de 365 dias e sem dias bissextos:

| Membro | Descrição |
|--------|-----------|
| `Loom.time.earthCalendar.timeToComponents(seconds)` | Divide um número de segundos em `{ years, days, hours, minutes, seconds }`. |
| `Loom.time.earthCalendar.format(components, 'duration', options?)` | Formata os componentes como texto, como `"2 days 3 hours"`. `options` aceita `maxTerms`, `short` (`"2d 3h"`) e `separator`. Qualquer modo diferente de `'duration'` retorna uma string vazia. |

## Alterando o relógio (só GM)

O servidor impõe o papel; qualquer outro usuário recebe `403`.

| Método | Descrição |
|--------|-----------|
| `await Loom.time.advance(seconds)` | Soma segundos ao horário do mundo. |
| `await Loom.time.set(seconds)` | Define o horário do mundo. |
| `await Loom.time.setScale(scale)` | Define a velocidade do relógio. |
| `await Loom.time.setCalendar(id)` | Escolhe o calendário do mundo pelo id. |

Estes chamam `PUT /api/worlds/:id/time` (ver a API de mundos).

## Hooks

| Hook | Argumentos | Quando |
|------|------------|--------|
| `updateWorldTime` | `(worldTime)` | Sempre que o servidor envia o relógio (em mudanças e a cada cerca de 30 s). |
| `timeScaleChanged` | `(scale, previousScale)` | A velocidade do relógio mudou. |
| `timePausedChanged` | `(paused)` | O mundo foi pausado ou retomado. |

O servidor também envia o evento WebSocket `time.updated` com `{ worldId, worldTime, timeScale, paused, serverNow, calendarId? }`.

## Registrando um calendário

Um addon declara um calendário como dados e o registra. Os dados são um objeto simples no formato descrito em [Campos do calendário](#campos-do-calendário). Ele é serializável em JSON, então um addon pode guardá-lo em um arquivo JSON, convertê-lo em objeto e passá-lo para `register`. `register` retorna a lista de problemas; uma lista vazia significa que foi aceito. Um calendário com o mesmo `id` substitui o anterior.

```js
const problems = Loom.time.calendars.register({
  id: 'two-moons',
  name: 'Calendar of the Two Moons',
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  weekdays: ['Sunday', 'Moonday', 'Fireday', 'Waterday', 'Windday'],
  months: [
    { name: 'Frostmoon', days: 30 },
    { name: 'Greenmoon', days: 30 },
    { name: 'Midyear Feast', days: 1, festival: true },
    { name: 'Sunmoon', days: 30 },
    { name: 'Harvestmoon', days: 30 },
    { name: 'Leap Feast', days: 0, leapDays: 1, festival: true },
  ],
  leapYear: { every: 4 },
  epochYear: 1200,
  eraName: 'TM',
  format: '{weekday}, {day} {month} {year} {era}',
});
if (problems.length) console.warn(problems);

await Loom.time.setCalendar('two-moons'); // GM
```

### Campos do calendário

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `id`, `name` | sim | Strings não vazias. |
| `secondsPerMinute`, `minutesPerHour`, `hoursPerDay` | sim | Inteiros positivos. |
| `weekdays` | sim | Nomes dos dias da semana, em ordem (pelo menos um). |
| `epochWeekday` | não | Índice em `weekdays` do primeiro dia do ano da época. Padrão `0`. |
| `months` | sim | Lista de `{ name, days, leapDays?, festival? }`. Pelo menos um mês deve ter `days > 0`. |
| `leapYear` | não | `{ every, offset?, skipEvery?, restoreEvery? }`: um ano é bissexto quando `(year - offset)` é divisível por `every`; anos divisíveis por `skipEvery` não são, a menos que também sejam divisíveis por `restoreEvery` (a regra Gregoriana é `every: 4, skipEvery: 100, restoreEvery: 400`). |
| `epochYear` | sim | O ano do calendário em que o horário `0` do mundo cai (o primeiro dia dele). |
| `eraName` | não | Texto para o token `{era}`. |
| `format` | não | Template com os tokens `{weekday}`, `{day}`, `{month}`, `{year}`, `{era}`, `{hour}`, `{minute}`, `{second}`. Padrão `{day} {month} {year} {era}`. |

Campos de mês:

- `days`: dias em um ano normal. `0` faz o mês existir **só em anos bissextos**.
- `leapDays`: dias extras que o mês ganha em um ano bissexto (fevereiro no calendário Gregoriano tem `days: 28, leapDays: 1`).
- `festival: true`: um dia com nome fora do ciclo da semana. Ele não avança o dia da semana, e a data dele tem o nome do dia da semana vazio (o formato remove o separador que sobraria).

Um horário do mundo `0` é o primeiro segundo do primeiro dia de `epochYear`. Horários negativos são datas antes da época.

## Objeto de data

`Loom.time.date()` retorna `{ year, monthIndex, month, day, dayOfYear, weekday, weekdayName, hour, minute, second, isLeapYear, festival }`. `day` e `dayOfYear` começam em 1. `weekday` é `-1` (e `weekdayName` fica vazio) em um dia de festival.

## Limites

- O slot `CONFIG.time.worldCalendarClass` ainda não é lido pelo core. Calendários são definições declarativas.
- Um calendário registrado com `Loom.time.calendars` existe só no navegador. Ele muda o que `date`, `formatDate` e a exibição do relógio mostram, mas não o servidor.
- O servidor conhece só o calendário Gregoriano. `setCalendar` guarda qualquer id (até 64 caracteres) sem verificá-lo, e o servidor usa o Gregoriano para um id que não conhece. Durações de efeitos em meses e anos (ver [Efeitos](effects.md)) são, portanto, convertidas com o Gregoriano, mesmo em um mundo que usa um calendário registrado no cliente.
