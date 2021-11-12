const readline = require('readline');
const fs = require('fs');
const util = require('util');
const path = require('path');
const { stdin: input, stdout: output } = require('process');

const puppeteer =  require('puppeteer');
const chalk = require('chalk');

const writeExcelFile = require('./excel');
const { isValidUrl, isNotEmpty, isNumber } = require('./validation');
const { sleep, log, logIssue } = require('./utils');

const cookiesFilePath = path.join(__dirname, 'cookies.json');
const resultFilePath = path.join(__dirname, 'profile.json');

const rl = readline.createInterface({ input, output });
const question = util.promisify(rl.question).bind(rl);

const checkAnswer = async (questionText, condition = () => {}, errorCb = () => {}) => {
  let answer;
  let isValid;

  do {
    answer = undefined;
    answer = await question(questionText);
    isValid = condition(answer);
    if (!isValid) {
      errorCb();
    }
  } while (!isValid);

  return answer;
}

const questions = async () => {
  try {
    const url = await checkAnswer(
      chalk.green.bold('URL measured site*: '),
      isValidUrl,
      () => logIssue('Type correct URL, example: http://localhost:5076/bidcenter/tabs/bidding')
    );

    const nodes = await checkAnswer(
      chalk.green.bold('Node element/s that need to trigger, separated by coma*: '),
      isNotEmpty,
      () => logIssue('This field cannot be empty')
    );

    const iterations = await checkAnswer(
      chalk.green.bold('Integer of iterations: '),
      isNumber,
      () => logIssue('Type correct number integer')
    );

    const delay = await checkAnswer(
      chalk.green.bold('Delay between actions in ms: '),
      isNumber,
      () => logIssue('Type correct number integer')
    );

    const title = await question(chalk.green.bold('Title your measuring (by default: ""): '));
    const colTitles = await question(chalk.green.bold('Title for every your cols, separated by coma, should be equal nodes except \':hover\' nodes (by default for every col: ""): '));
    const description = await question(chalk.green.bold('Description your measuring (by default: ""): '));

    rl.close();

    const arrayNodes = nodes.split(',').map(node => node.trim());
    const arrayColTitles = colTitles.split(',').map(node => node.trim());
    let copyArrayColTitles = [...arrayColTitles];

    if (arrayColTitles.length < arrayNodes.length) {
      const ignoredHoverActionNode = arrayNodes.filter(node => !node.includes(':hover'));
      copyArrayColTitles = new Array(ignoredHoverActionNode.length)
        .fill('')
        .map((_, idx) => arrayColTitles[idx] || '')
    }

    const info = { title, colTitles: copyArrayColTitles, description };

    return { url, nodes: arrayNodes , iterations, delay, info };

  } catch (e) {
    console.error(e);
  }
};

const saveCookies = (cookiesObject) => {
  fs.writeFile(cookiesFilePath, JSON.stringify(cookiesObject), (err) => {
    if (err) {
      console.error('The file could not be written.', err);
    }
    log('Session has been successfully saved');
  });
}

const readCookies = async (page) => {
  const content = fs.readFileSync(cookiesFilePath);
  const cookiesArr = JSON.parse(content);
  if (cookiesArr.length !== 0) {
    for (let cookie of cookiesArr) {
      await page.setCookie(cookie)
    }
    log('Session has been loaded in the browser');
  }
}

const getClickTimings = (path) => {
  const data = fs.readFileSync(path, (err) => {
    if (err) console.error(err);
  });

  const parsedData = JSON.parse(data);

  return parsedData.traceEvents.reduce((accum, data) => {
    if (
      data.args.data?.type === 'click' &&
      !data.args.data.stackTrace &&
      !data.args.frame &&
      data.dur
    ) {
      accum.push(+(data.dur / 1000).toFixed(2));
    }
    return accum;
  }, []);
}

const checkSession = async (page) => {
  const cookiesObject = await page.cookies();
  const previousSession = fs.existsSync(cookiesFilePath);

  if (previousSession) {
    await readCookies(page);
  } else {
    saveCookies(cookiesObject);
  }
};

const action = async (page, navigationPromise, node, type) => {
  await page.waitForSelector(node, { timeout: 120000, visible: true });
  await navigationPromise;
  await page[type](node);
}

const triggerActions = async (nodes, iterations, delay, page, navigationPromise) => {
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < nodes.length; j++) {
      try {
        const currentNode = nodes[j];
        if (currentNode.includes(':hover')) {
          const clearNode = currentNode.replace(':hover', '');
          await action(page, navigationPromise, clearNode, 'hover');
          log(`Iteration: ${i + 1}, Node hover: ${currentNode}`);

        } else {
          await action(page, navigationPromise, currentNode, 'click');
          log(`Iteration: ${i + 1}, Node click: ${currentNode}`);

          await sleep(delay);
        }
      } catch(e) {
        console.error(e);
      }
    }
  }
};

const executeScript = async () => {
  try {
    const { url, nodes, iterations, delay, info } = await questions();

    const browser = await puppeteer.launch({ headless: false, userDataDir: "./user_data" });
    const page = await browser.newPage();

    await checkSession(page);

    const navigationPromise = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 });
    await page.goto(url)
    await page.setViewport({ width: 1296, height: 1088 });

    log('Loading page...');
    await navigationPromise;

    log('Starting measuring...');
    await page.tracing.start({ path: resultFilePath });

    log('Starting execution actions...');
    await triggerActions(nodes, iterations, delay, page, navigationPromise);

    log('Finishing measuring...');
    await page.tracing.stop();

    log(`Finish result in ${resultFilePath}`);
    await browser.close();

    log(`Getting timing from ${resultFilePath}...`);
    const timing = getClickTimings(resultFilePath);

    log('Writing excel file...');
    await writeExcelFile(info, timing);

    log('Excel ready.');
  }
  catch (e) {
    console.error(e);
  }
};

executeScript();
