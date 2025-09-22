import http from 'node:http'

const head = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .container {
      width: 80%;
      margin: 0 auto;
    }
    .box {
      border-radius: 10px;
      border: 2px solid blue;
      padding: 20px;
      width: 50%;
    }
    .posted {
      display: none;
    }
    .tx_head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .postings {
      border: 1px solid darkblue;
      padding: 4px;
    }
    .prow {
      margin: 1px;
      display: flex;
      background-color: whitesmoke;
    }
    .debit {
      background-color: lightgrey;
    }
    .prow .amount {
      margin-left: auto;
      margin-right: 0;
    }
    .actions {
      display: flex;
      margin-left: auto;
      margin-right: 0;
    }
  </style>
</head>
`

const body = `
<body>
  <div class="container">
    <h1>Ledger Budget Entry</h1>
    <p>
      This is some really long text just to see what the page width is like to
      see if I'm getting the style right so that things look acceptable.
    </p>
`

const script = `
<script>
  const update_buttons = document.querySelectorAll('#update_button')

  function handleUpdateClick() {
    console.log('Button clicked!')
  }

  update_buttons.forEach(b => {
    b.addEventListener('click', handleUpdateClick)
  })

  const del_buttons = document.querySelectorAll('#delete_button')

  function handleDeleteClick() {
    alert("DELETED!? 😎")
  }

  del_buttons.forEach(b => {
    b.addEventListener('click', handleDeleteClick)
  })

  const post_buttons = document.querySelectorAll('#posted_button')

  function handlePostingClick(event) {
    const i = event.target.dataset.i
    const post_el = document.getElementById('posted' + i)
    console.log(\`toggling post \${i}, current state \${post_el.style.display}\`)
    if (post_el.style.display === 'none') {
      post_el.style.display = 'block'
    } else {
      post_el.style.display = 'none'
    }
  }

  post_buttons.forEach(b => {
    b.addEventListener('click', handlePostingClick)
  })
</script>
`

const make_tx_row = (tx, i) => {
  // TODO: postings are always 2 per transaction right now, will have to
  // support multiple postings (split transactions) soon
  return `
    <div style="display: flex;">
      <div class="box">
        <div class="tx_head">
          <div>${tx.date}</div>
          <div class="posted" id="posted${i}" style="display: none;">*</div>
          <div>${tx.payee}</div>
        </div>
        <div class="postings">
          <div class="prow">
            <div class="account">${tx.credit}</div>
            <div class="amount">${tx.amount}</div>
          </div>
          <div class="prow debit">
            <div class="account">${tx.debit}</div>
            <div class="amount">-${tx.amount}</div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button id="update_button">Update</button>
        <button id="posted_button" data-i=${i}>Toggle Post</button>
        <button id="delete_button">Delete</button>
      </div>
    </div>
  `
}

const server = async (transactions) => {
  const handler = (req, res) => {
    res.writeHead(200, {'Content-Type': 'text/HTML'})

    const table = () => {
      return transactions.map(make_tx_row).join('\n')
    }

    res.end(head + body + table() + '</div></body>' + script + '</html>')
  }

  const s = http.createServer(handler)

  return s.listen(8888)
}

export default {
  server
}
