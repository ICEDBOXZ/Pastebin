const fs = require('fs');
const path = require('path');
const http = require('http');

const host = process.env.NODE_HOST || "0.0.0.0";
const port = process.env.NODE_PORT || 3000;
const datadir = process.env.NODE_DATA_DIR || "data";

if (!fs.existsSync(datadir)) {
  console.error("Директория не существует: " + datadir);
  process.exit(1);
}

function htmlencode(c) {
  c = c.replace(/&/g, '&amp;');
  c = c.replace(/</g, '&lt;');
  c = c.replace(/>/g, '&gt;');
  return c;
}

function regex(url) {
  let m = /^\/?([A-Za-z0-9\-]+)$/g.exec(url);
  return m ? m[1] : null;
}

function render(model) {
  let content = htmlencode(model.content);
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" integrity="sha384-xOolHFLEh07PJGoPkLv1IbcEPTNtaed2xpHsD9ESMhqIYd0nLMwNLD69Npy4HI+N" crossorigin="anonymous">
  <title>Pastebin</title>
    <script>
  document.addEventListener('DOMContentLoaded', function() {
    const deleteButtons = document.querySelectorAll('.delete-button');

    deleteButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        const id = this.dataset.id;
        if (confirm('Вы уверены, что хотите удалить этот фрагмент?')) {
          fetch('/' + id, {
            method: 'DELETE',
          })
          .then(response => {
            if (response.ok) {
              return response.text();
            } else {
              throw new Error('Что-то пошло не так при удалении файла.');
            }
          })
          .then(() => {
            window.location.href = '/';
          })
          .catch(error => {
            console.error('Ошибка:', error);
          });
        }
      });
    });
  });
  </script>
</head>
<body style="background: #eee;">
  <form action="/${model.id}" method="post">
  
    <div class="container-fluid mt-3">
    
      <div class="row">
        <div class="col-12 d-flex">
          <h3 class="text-monospace">Pastebin <a href="/${model.id}" class="text-primary text-monospace">${model.id}</a></h3>
          <div class="ml-auto">
            <a href="/" class="btn btn-sm btn-outline-primary" accesskey="q">Создать</a>
            <button class="btn btn-sm btn-success" type="submit" accesskey="s">Сохранить</button>
            <button class="btn btn-sm btn-success delete-button" data-id="${model.id}" type="button">Удалить</button>
          </div>
        </div>
        <div class="col-12">
          <div class="form-group">
            <textarea autofocus name="content" placeholder="Вставьте текст..." rows="20" class="form-control text-monospace w-100 h-75">${content}</textarea>
          </div>
          <div class="form-group">
            <label for="expiry">Время истечения срока действия (в минутах):</label>
            <input type="number" id="expiry" name="expiry" min="1" class="form-control">
          </div>
        </div>
      </div>
      
    </div>

  </form>
</body>
</html>`;
  return html;
}

const server = http.createServer(function(request, response) {
  
  //Ввод данных /
  if (request.method == "GET" && request.url == "/") {
    let id = Math.random().toString(36).substr(2, 9);
    let model = { id, mode: "new", content: "" };
    response.writeHead(200, { "Content-Type": "text/html" });
    return response.end(render(model));
  }
  
  //Просмотр данных
  if (request.method == "GET" && regex(request.url)) {
    let id = regex(request.url);
    let file = path.join(datadir, id) + ".json";
    
    if (fs.existsSync(file)) {
      let data = JSON.parse(fs.readFileSync(file, "utf-8"));
      let expiryDate = new Date(data.expiry);
      
      if (new Date() > expiryDate) {
        fs.unlinkSync(file); // Удалите файл, если срок его действия истёк
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("Фрагмент больше не доступен");
      } else {
        let model = { id, mode: "edit", content: data.content };
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(render(model));
      }
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Фрагмент не найден");
    }
  }
  
  //Сохранение
  if (request.method == "POST" && regex(request.url)) {
    let id = regex(request.url);
    
    let body = "";
    request.on('data', function(data) {
      body += data;
    });
    request.on('end', function() {
      let params = new URLSearchParams(body);
      let content = params.get('content');
      let expiry = parseInt(params.get('expiry'), 10);
      let expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + expiry);
    
      let file = path.join(datadir, id) + ".json";
      let data = JSON.stringify({ content, expiry: expiryDate });
      fs.writeFileSync(file, data);
    });
    
    return;
  }
  
  //Удаление
  if (request.method === "DELETE" && regex(request.url)) {
    let id = regex(request.url);
    let file = path.join(datadir, id) + ".txt";
    
    // Проверяем, существует ли файл, и если да, то удаляем его
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Файл удален");
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Файл не найден");
    }
  }

});

server.listen(port, host);
console.log(`Запущено на http://${host}:${port}`);