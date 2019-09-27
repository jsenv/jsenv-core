import AwaitValue from "../AwaitValue/AwaitValue.js"

function AsyncGenerator(gen) {
  var front
  var back
  function send(key, arg) {
    return new Promise(function(resolve, reject) {
      var request = {
        key,
        arg,
        resolve,
        reject,
        next: null,
      }
      if (back) {
        back = back.next = request
      } else {
        front = back = request
        resume(key, arg)
      }
    })
  }
  function resume(key, arg) {
    try {
      var result = gen[key](arg)
      var value = result.value
      var wrappedAwait = value instanceof AwaitValue
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(
        function(arg) {
          if (wrappedAwait) {
            resume("next", arg)
            return
          }
          settle(result.done ? "return" : "normal", arg)
        },
        function(err) {
          resume("throw", err)
        },
      )
    } catch (err) {
      settle("throw", err)
    }
  }
  function settle(type, value) {
    switch (type) {
      case "return":
        front.resolve({ value, done: true })
        break
      case "throw":
        front.reject(value)
        break
      default:
        front.resolve({ value, done: false })
        break
    }
    front = front.next
    if (front) {
      resume(front.key, front.arg)
    } else {
      back = null
    }
  }
  this._invoke = send
  // Hide "return" method if generator return is not supported
  if (typeof gen.return !== "function") {
    this.return = undefined
  }
}
if (typeof Symbol === "function" && Symbol.asyncIterator) {
  AsyncGenerator.prototype[Symbol.asyncIterator] = function() {
    return this
  }
}
AsyncGenerator.prototype.next = function(arg) {
  return this._invoke("next", arg)
}
AsyncGenerator.prototype.throw = function(arg) {
  return this._invoke("throw", arg)
}
AsyncGenerator.prototype.return = function(arg) {
  return this._invoke("return", arg)
}

export default AsyncGenerator