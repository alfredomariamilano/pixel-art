import { h, render, Component } from 'preact'
import { APP, VIEW, initCanvases, newData } from './data'
import { undo, redo } from './undo-redo'
import { setTool } from './canvas'
import { setupKeyListeners } from './keyboard'

// Components
import { Color } from './color'
import { Timeline } from './timeline'
import { Canvas, paintCanvas } from './canvas'

const loadData = ({ onLoaded, onError }) => {
  //console.time('startRead')
  localforage.getItem('pixel-art-app').then((stored) => {
    //console.timeEnd('startRead')
    for (const key in stored) {
      APP[key] = stored[key]
    }

    onLoaded()
  }).catch(function(err) {
    console.log(err)
    onError()
  });
}

const saveData = () => {
  //console.time('startwrite')
  localforage.setItem('pixel-art-app', APP).then(function(value) {
    // This will output `1`.
    //console.timeEnd('startwrite')
  }).catch(function(err) {
    // This code runs if there were any errors
    console.log(err);
  });
}

const downloadCanvas = (e) => {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  const height = APP.height * VIEW.downloadCanvas.size
  const width = APP.width * VIEW.downloadCanvas.size

  if (VIEW.downloadCanvas.type === 'frame') {
    c.width = width
    c.height = height

    ctx.webkitImageSmoothingEnabled = false
    ctx.mozImageSmoothingEnabled = false
    ctx.imageSmoothingEnabled = false

    APP.layers.forEach(layer => {
      VIEW.canvasTemp.ctx.putImageData(layer.frames[APP.frameActive], 0, 0)
      ctx.drawImage(VIEW.canvasView.dom, 0, 0, c.width, c.height)
    })
  }

  if (VIEW.downloadCanvas.type === 'spritesheet') {
    const totalWidth = APP.width * VIEW.downloadCanvas.size * APP.frameCount
    c.width = totalWidth
    c.height = height

    ctx.webkitImageSmoothingEnabled = false
    ctx.mozImageSmoothingEnabled = false
    ctx.imageSmoothingEnabled = false

    console.log(APP.frameCount)
    for (let frameI = 0; frameI < APP.frameCount; frameI++) {
      APP.layers.forEach(layer => {
        VIEW.canvasTemp.ctx.putImageData(layer.frames[frameI], 0, 0)
        ctx.drawImage(VIEW.canvasTemp.dom, frameI * width, 0, width, height)
      })
    }
  }

  const image = c.toDataURL('image/png').replace('image/png', 'image/octet-stream')
  e.target.setAttribute('href', image)
}

class View extends Component{
  componentDidMount () {
    VIEW.render = () => {
      this.setState({}, () => {
        VIEW.canvasTemp.ctx.clearRect(0, 0, APP.width, APP.height)
        VIEW.canvasFinal.ctx.clearRect(0, 0, APP.width, APP.height)
        VIEW.canvasView.ctx.clearRect(0, 0, APP.width, APP.height)

        APP.layers.forEach((layer, i) => {
          VIEW.canvasView.ctx.globalAlpha = 1

          if (layer.hidden) return

          // Onion skinning
          if (APP.layerActive === i && VIEW.onionSkinning && !VIEW.isPlaying) {
            const framesAhead = 3
            const framesBehind = 3
            const framesTotal = framesBehind + framesAhead

            VIEW.canvasView.ctx.globalAlpha = .5

            for (let a = framesAhead - framesTotal; a < framesAhead; a++) {
              if (!layer.frames[APP.frameActive - a]) continue

              const target = layer.frames[APP.frameActive - a] 
              VIEW.canvasTemp.ctx.putImageData(target, 0, 0)
              VIEW.canvasView.ctx.drawImage(VIEW.canvasTemp.dom, 0, 0)
            }
          }

          // Regular frame render
          VIEW.canvasView.ctx.globalAlpha = 1

          const target = layer.frames[APP.frameActive]

          for (let b = 0; b < 2; b++) { // For whatever reason safari makes me do this twice
            // Target Canvas
            VIEW.canvasTemp.ctx.putImageData(target, 0, 0)
            VIEW.canvasView.ctx.drawImage(VIEW.canvasTemp.dom, 0, 0)
            
            // Preview Canvas
            if (APP.layerActive === i) {
              VIEW.canvasTemp.ctx.putImageData(VIEW.canvasPreview.imgData, 0, 0)
              VIEW.canvasView.ctx.drawImage(VIEW.canvasTemp.dom, 0, 0)
            }
          }
        })
      })
    }

    initCanvases()

    this.funcs = { paintCanvas }

    // View control customization
    this.canvasOuterScroll = document.querySelector('#canvas-outer-scroll')
    this.canvasInnerScroll = document.querySelector('#canvas-inner-scroll')

    this.timelineScroll = {
      isSyncingLeftScroll: false,
      isSyncingRightScroll: false,
      leftDiv: document.querySelector('#layers'),
      rightDiv: document.querySelector('#frames')
    }

    this.timelineScrollController()
    this.centerCanvas()

    // Adding google analytics
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'UA-144729452-1');
  }

  centerCanvas () {
    const outerW = this.canvasOuterScroll.offsetWidth
    const innerW = this.canvasInnerScroll.offsetWidth
    const outerH = this.canvasOuterScroll.offsetHeight
    const innerH = this.canvasInnerScroll.offsetHeight
    
    this.canvasOuterScroll.scrollLeft = Math.floor((innerW - outerW) / 2) + 8
    this.canvasOuterScroll.scrollTop = Math.floor((innerH - outerH) / 2) + 8
  }

  timelineScrollController () {
    this.timelineScroll.leftDiv.addEventListener('scroll', (e) => {
      if (!this.timelineScroll.isSyncingLeftScroll) {
        this.timelineScroll.isSyncingRightScroll = true
        this.timelineScroll.rightDiv.scrollTop = e.target.scrollTop
      }
      this.timelineScroll.isSyncingLeftScroll = false
    })
    
    this.timelineScroll.rightDiv.addEventListener('scroll', (e) => {
      if (!this.timelineScroll.isSyncingRightScroll) {
        this.timelineScroll.isSyncingLeftScroll = true
        this.timelineScroll.leftDiv.scrollTop = e.target.scrollTop
      }
      this.timelineScroll.isSyncingRightScroll = false
    })
  }

  onGestureDown (e) {
    if (!VIEW.isPlaying) 

    VIEW.window.request = e.target.dataset.request || ''
    VIEW.window.mouseDown = true
    VIEW.window.startX = (e.pageX === undefined) ? e.touches[0].pageX : e.pageX
    VIEW.window.startY = (e.pageY === undefined) ? e.touches[0].pageY : e.pageY
    VIEW.window.prevX = (e.pageX === undefined) ? e.touches[0].pageX : e.pageX
    VIEW.window.prevY = (e.pageY === undefined) ? e.touches[0].pageY : e.pageY
    VIEW.window.currX = (e.pageX === undefined) ? e.touches[0].pageX : e.pageX
    VIEW.window.currY = (e.pageY === undefined) ? e.touches[0].pageY : e.pageY

    if (VIEW.window.request) this.funcs[VIEW.window.request]('start')
  }
  
  onGestureDrag (e) {
    if (!VIEW.isPlaying) 

    VIEW.window.prevX = VIEW.window.currX
    VIEW.window.prevY = VIEW.window.currY
    VIEW.window.currX = (e.pageX === undefined) ? e.touches[0].pageX : e.pageX
    VIEW.window.currY = (e.pageY === undefined) ? e.touches[0].pageY : e.pageY
    
    if (VIEW.window.request) this.funcs[VIEW.window.request]('resume')
  
    if (e.target.tagName !== 'INPUT') { // prevent block on input range elements
      e.preventDefault() // block pull to refresh on mobile browsers
    }
  }

  onGestureEnd (e) {
    if (!VIEW.isPlaying)

    if (VIEW.window.request) this.funcs[VIEW.window.request]('end')

    VIEW.window.request = ''
    VIEW.window.mouseDown = false
    VIEW.window.startX = 0
    VIEW.window.startY = 0
    VIEW.window.prevX = 0
    VIEW.window.prevY = 0
    VIEW.window.currX = 0
    VIEW.window.currY = 0

    setTimeout(() => {
      saveData()
    }, 50)
  }

  onGestureHover (e) {
    if (!VIEW.isPlaying)

    VIEW.window.prevX = VIEW.window.currX
    VIEW.window.prevY = VIEW.window.currY
    VIEW.window.currX = (e.pageX === undefined) ? e.touches[0].pageX : e.pageX
    VIEW.window.currY = (e.pageY === undefined) ? e.touches[0].pageY : e.pageY

    if (e.target.dataset.hover) this.funcs[e.target.dataset.hover]('hover')
  }
  
  dragOrHover (e) {
    if (VIEW.window.mouseDown) {
      this.onGestureDrag(e)
    } else {
      this.onGestureHover(e)
    }
  }

  render () {
    return (
      <div
        class='h-full relative'
        onMouseDown={(e) => { if (e.which === 1) this.onGestureDown(e); }}
        onMouseMove={(e) => { this.dragOrHover(e) }}
        onMouseUp={(e) => { this.onGestureEnd(e) }}>
        <div class='h-40 bg-light bord-dark-b fl'>
          <div class="fl w-full">
            <div class="fl-1 fl">
              <div class="fl bord-dark-r rel w-40"
                onMouseLeave={() => {
                  VIEW.file.open = false
                  VIEW.render()
                }}>
                <button
                  onClick={() => {
                    VIEW.file.open = !VIEW.file.open
                    VIEW.render()
                  }}
                  class="fl fl-center m-0 p-0 w-40">
                  <img src="img/bars.svg" />
                </button>
                <div
                  class="bg-light fl-column bord-dark abs z-5"
                  style={`visibility: ${VIEW.file.open ? 'visible' : 'hidden'}; top: 10px; left: 10px;`}>
                    <button
                      onClick={() => {
                        VIEW.newCanvas.open = true
                        VIEW.file.open = false
                        VIEW.render()
                      }}
                      class="m-0 p-h-15 h-40 fl fl-center-y">
                      <img src={`img/new.svg`} />
                      <small class="bold p-h-10" style='text-transform: capitalize;'>New</small>
                    </button>
                    <button
                      onClick={() => {
                        VIEW.downloadCanvas.open = true
                        VIEW.file.open = false
                        VIEW.render()
                      }}
                      class="m-0 p-h-15 h-40 fl fl-center-y">
                      <img src={`img/download.svg`} />
                      <small class="bold p-h-10" style='text-transform: capitalize;'>download</small>
                    </button>
                </div>
              </div>
              <div class='fl-1 fl fl-justify-center'>
                <button
                  onClick={() => { undo() }}
                  class="fl fl-center m-0 p-0 w-40 bord-dark-l bord-dark-r">
                  <img src="img/undo.svg" />
                </button>
                <button
                  onClick={() => { redo() }}
                  class="fl fl-center m-0 p-0 w-40 bord-dark-r">
                  <img src="img/redo.svg" />
                </button>
              </div>
            </div>
            <div class="fl" style="max-width: 241px; min-width: 241px;">
              
            </div>
          </div>
        </div>
        <div class='fl' style='height: calc(100% - 40px); '>
          <div class='w-40 bg-light bord-dark-r'>
            {
              ['pencil', 'eraser', 'line', 'circle', 'square', 'fill', 'eye-dropper', 'move'].map(tool => 
                <button
                  onClick={() => { setTool(tool) }}
                  class="fl fl-center m-0 p-0 w-40 h-40 bord-dark-r"
                  style={`${APP.tool === tool ? 'background: rgba(52, 152, 219, 255);' : ''}`}>
                  <img src={`img/${tool}.svg`} />
                </button>
              )
            }
          </div>
          <div class='fl-column' style='width: calc(100% - 281px);'>
            <div
              id='canvas-outer-scroll'
              class={`overflow fl-1 cursor-${APP.tool}`}>
              <Canvas />
            </div>
            <Timeline />
            {/* <div class='fl-1 h-full fl'>
              <div class='fl-1 fl-column h-full' style='width: calc(100% - 281px);'>
                <Canvas />
                <Timeline />
              </div>
            </div> */}
          </div>
          <div class='bg-light bord-dark-l fl-column' style="max-width: 241px; min-width: 241px;">
            <div class='bord-dark-b fl-column overflow'>
              <div class='h-30 bg-mid bord-dark-b fl fl-center-y p-h-10'>
                <small><b>Tool</b></small>
              </div>
              <div class='fl-1 overflow'>
                <div class="fl fl-center p-10">
                  <small class="bold" style="width: 150px;">Brush Size</small>
                  <select
                    onInput={(e) => {
                      VIEW.brushSize = parseInt(e.target.value)
                    }}
                    value={VIEW.brushSize}
                    class="w-full">
                      {
                        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size, i) => {
                          return <option value={i}>{size}</option>
                        })
                      }
                  </select>
                </div>
              </div>
            </div>
            <Color />
            <div class='fl-1 bord-dark-b fl-column overflow'>
              <div class='h-30 bg-mid bord-dark-b fl fl-center-y p-h-10'>
                <small><b>History</b></small>
              </div>
              <div class='fl-1 overflow'>
                {
                  VIEW.undo.map((entry, i) => {
                    return <button class={`p-h-10 h-30 w-full txt-left fl fl-center-y ${VIEW.undoPos === i ? 'bg-xlight' : ''}`} >
                      <img width='10' height='10' style='margin-right: 10px;' src={`img/${entry.icon}`} />
                      <small style='text-transform: capitalize; font-size: 11px;'><b>{entry.action}</b></small>
                    </button>
                  })
                }
              </div>
            </div>
            <div style='min-height: 249px; max-height: 249px;'>
              <div class='h-30 bg-mid bord-dark-b fl fl-center-y p-h-10'>
                <small><b>Timeline</b></small>
              </div>
              <div class='overflow fl-1'>
                
              </div>
            </div>
          </div>
        </div>
        {VIEW.newCanvas.open && <div class="abs top left w-full h-full fl fl-justify-center" style="z-index: 10;">
          <div class="w-full overflow-hidden" style="max-width: 300px; margin-top: 175px;">
            <div class="fl fl-center bg-mid bord-dark p-v-5" style='border-top-right-radius: 5px; border-top-left-radius: 5px;'><small><b>New Canvas</b></small></div>
            <div class="p-10 bg-light bord-dark-l bord-dark-r bord-dark-b" style='border-bottom-right-radius: 5px; border-bottom-left-radius: 5px;'>
              <div class="m-5 p-v-5">
                <div class="fl fl-center">
                  <small class="bold" style="width: 150px;">Dimensions</small>
                  <select
                    onInput={(e) => {
                      const val = e.target.value.split('x')
                      VIEW.newCanvas.w = parseInt(val[0])
                      VIEW.newCanvas.h = parseInt(val[1])
                    }}
                    class="w-full">
                    <option value="32x32">32x32</option>
                    <option value="50x50">50x50</option>
                    <option value="64x64">64x64</option>
                    <option value="100x100">100x100</option>
                    <option value="128x128">128x128</option>
                  </select>
                </div>
              </div>
              <div class="fl" style="padding-top: 5px;">
                <button
                  onClick={() => {
                    VIEW.newCanvas.open = false
                    VIEW.render()
                  }}
                  class="b-r-2 bold p-5 w-full bg-red m-5">Cancel</button>
                <button
                  onClick={() => {
                    newData(VIEW.newCanvas.w, VIEW.newCanvas.h)
                    VIEW.newCanvas.open = false
                    VIEW.render()
                  }}
                  class="b-r-2 bold p-5 w-full bg-green m-5">Confirm</button>
              </div>
            </div>
          </div>
        </div>}
        {VIEW.downloadCanvas.open && <div class="abs top left w-full h-full fl fl-center-x" style="z-index: 10;">
          <div class="w-full" style="max-width: 300px; overflow: hidden; margin-top: 175px;">
              <div class="fl fl-center bg-mid bord-dark p-v-5" style='border-top-right-radius: 5px; border-top-left-radius: 5px;'><small class="bold">Download</small></div>
              <div class="p-10 bg-light bord-dark-l bord-dark-r bord-dark-b" style='border-bottom-right-radius: 5px; border-bottom-left-radius: 5px;'>
                <div class="m-5 p-v-5">
                  <div class="fl fl-center">
                    <small class="bold" style="width: 150px;">Type</small>
                    <select
                      onInput={(e) => {
                        VIEW.downloadCanvas.type = e.target.value
                      }}
                      value={VIEW.downloadCanvas.type}
                      id="config-download-size" class="w-full">
                        <option value="frame">Frame</option>
                        <option value="spritesheet">Spritesheet</option>
                    </select>
                  </div>
                </div>
                <div class="m-5 p-v-5">
                    <div class="fl fl-center">
                      <small class="bold" style="width: 150px;">Size</small>
                      <select
                        onInput={(e) => {
                          VIEW.downloadCanvas.size = parseInt(e.target.value)
                        }}
                        value={VIEW.downloadCanvas.size}
                        id="config-download-size" class="w-full">
                          <option value="2">2x</option>
                          <option value="4">4x</option>
                          <option value="8">8x</option>
                          <option value="16">16x</option>
                          <option value="32">32x</option>
                          <option value="64">64x</option>
                      </select>
                    </div>
                </div>
                <div class="fl" style="padding-top: 5px;">
                  <button
                    onClick={() => {
                      VIEW.downloadCanvas.open = false
                      VIEW.render()
                    }}
                    class="b-r-2 bold p-5 w-full bg-red m-5">Cancel</button>
                  <a
                    onClick={(e) => {
                      downloadCanvas(e)
                    }}
                    class="w-full m-5 clickable" download="pixel-art.png" style="display: inline-block;">
                    <button class="b-r-2 bold p-5 w-full bg-green no-ptr">Download</button>
                  </a>
                </div>
              </div>
          </div>
        </div>}
      </div>
    )
  }
}

const onProgramStart = () => {
  console.log('Program started.')

  newData(64, 64, true)
  render(<View />, document.body)
  
  loadData({
    onLoaded: () => {
      initCanvases()
      VIEW.render()
    },
    onError: () => {}
  })

  setupKeyListeners()
  
  window.addEventListener('keyup', () => {
    saveData()
  })  
}

window.addEventListener('load', onProgramStart)

window.addEventListener('beforeunload', (event) => {
  event.returnValue = `Are you sure you want to leave?`;
});
