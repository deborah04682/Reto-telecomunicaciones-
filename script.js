document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Interfaz cargada.");

    const brokerUrl = 'wss://rc21f000.ala.us-east-1.emqxsl.com:8084/mqtt';
    const options = { clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8), username: 'cyberpunk', password: 'edgerunners', clean: true, connectTimeout: 4000 };
    let client = null; 
    let timeoutDesconexion = null; 
    
    let historialSecuencias = []; 
    let tiempoGlobal = 0; 

    let bufferVoltaje = [];
    let bufferCorriente = [];
    let bufferPotencia = [];

    let tablaC1Activa = false;
    let timeoutTablaC1 = null;
    let tablaC2Activa = false;
    let timeoutTablaC2 = null;

    const btnMqtt = document.getElementById('btnMqtt');
    const switchC1 = document.getElementById('switchC1');
    const switchC2 = document.getElementById('switchC2');
    
    const btnReiniciarC1 = document.getElementById('btnReiniciarC1');
    const btnReiniciarC2 = document.getElementById('btnReiniciarC2');

    const btnTablaC1 = document.getElementById('btnTablaC1');
    const btnTablaC2 = document.getElementById('btnTablaC2');
    const btnVerSecuencias = document.getElementById('btnVerSecuencias');
    const modal = document.getElementById('modalSecuencias');
    const closeModal = document.getElementById('closeModal');
    const listaSecuencias = document.getElementById('listaSecuencias');

    // --- 1. CONFIGURACIÓN DE GRÁFICAS ---
    const chartIds = ['graficaVoltajeC1', 'graficaCorrienteC1', 'graficaPotenciaC1', 'graficaVoltajeC2', 'graficaCorrienteC2', 'graficaPotenciaC2'];
    chartIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) { const existing = Chart.getChart(canvas); if (existing) existing.destroy(); }
    });

    const configBase = { 
        type: 'line', 
        options: { 
            responsive: true, animation: false, parsing: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { enabled: true } },
            scales: { x: { title: { display: true, text: 'Tiempo (s)' } }, y: { beginAtZero: true } } 
        } 
    };

    const chartVoltajeC1 = new Chart(document.getElementById('graficaVoltajeC1'), { ...configBase, data: { labels: [], datasets: [{ label: 'Vrms C1', data: [], borderColor: '#7550b9', tension: 0.1 }] } });
    const chartCorrienteC1 = new Chart(document.getElementById('graficaCorrienteC1'), { ...configBase, data: { labels: [], datasets: [{ label: 'Irms C1', data: [], borderColor: '#ff6384', tension: 0.1 }] } });
    const chartPotenciaC1 = new Chart(document.getElementById('graficaPotenciaC1'), { ...configBase, data: { labels: [], datasets: [{ label: 'Potencia C1 (W)', data: [], borderColor: '#ffcd56', tension: 0.1 }] } });

    const chartVoltajeC2 = new Chart(document.getElementById('graficaVoltajeC2'), { ...configBase, data: { labels: [], datasets: [{ label: 'Vrms C2', data: [], borderColor: '#4bc0c0', tension: 0.1 }] } });
    const chartCorrienteC2 = new Chart(document.getElementById('graficaCorrienteC2'), { ...configBase, data: { labels: [], datasets: [{ label: 'Irms C2', data: [], borderColor: '#ff9f40', tension: 0.1 }] } });
    const chartPotenciaC2 = new Chart(document.getElementById('graficaPotenciaC2'), { ...configBase, data: { labels: [], datasets: [{ label: 'Potencia C2 (W)', data: [], borderColor: '#9966ff', tension: 0.1 }] } });

    // --- 2. LÓGICA DE CONEXIÓN MQTT ---
    function conectarMQTT() {
        if (client) return;
        client = mqtt.connect(brokerUrl, options);

        client.on('connect', () => {
            console.log('✅ Conectado al broker MQTT');
            btnMqtt.innerText = "Desconectar Broker";
            btnMqtt.classList.replace('disconnected', 'connected');
            client.subscribe('emqx/esp32');
            reiniciarTimeout(); 
        });

        client.on('message', (topic, message) => {
            reiniciarTimeout(); 
            procesarMensaje(message.toString());
        });

        client.on('close', () => {
            console.log('❌ Desconectado del broker MQTT');
            btnMqtt.innerText = "Conectar Broker";
            btnMqtt.classList.replace('connected', 'disconnected');
        });
    }

    function desconectarMQTT() {
        if (client) { client.end(); client = null; }
        clearTimeout(timeoutDesconexion);
    }

    function reiniciarTimeout() {
        clearTimeout(timeoutDesconexion);
        timeoutDesconexion = setTimeout(() => {
            console.warn("⚠️ Timeout de 10 minutos. Desconectando...");
            desconectarMQTT();
        }, 600000); 
    }

    btnMqtt.addEventListener('click', () => {
        if (client) desconectarMQTT();
        else conectarMQTT();
    });

    // --- 3. BOTONES DE REINICIAR GRÁFICAS ---
    btnReiniciarC1.addEventListener('click', () => {
        tiempoGlobal = 0;
        
        chartVoltajeC1.data.labels = []; chartVoltajeC1.data.datasets[0].data = []; chartVoltajeC1.update();
        chartCorrienteC1.data.labels = []; chartCorrienteC1.data.datasets[0].data = []; chartCorrienteC1.update();
        chartPotenciaC1.data.labels = []; chartPotenciaC1.data.datasets[0].data = []; chartPotenciaC1.update();

        bufferVoltaje = [];
        bufferCorriente = [];
        bufferPotencia = [];

        console.log("🔄 Gráficas del Canal 1 reiniciadas.");
    });

    btnReiniciarC2.addEventListener('click', () => {
        tiempoGlobal = 0;
        
        chartVoltajeC2.data.labels = []; chartVoltajeC2.data.datasets[0].data = []; chartVoltajeC2.update();
        chartCorrienteC2.data.labels = []; chartCorrienteC2.data.datasets[0].data = []; chartCorrienteC2.update();
        chartPotenciaC2.data.labels = []; chartPotenciaC2.data.datasets[0].data = []; chartPotenciaC2.update();

        bufferVoltaje = [];
        bufferCorriente = [];
        bufferPotencia = [];

        console.log("🔄 Gráficas del Canal 2 reiniciadas.");
    });

    // --- 4. SWITCHES MANUALES ---
    switchC1.addEventListener('change', (e) => {
        if (tablaC1Activa) { 
            e.preventDefault(); 
            switchC1.checked = !switchC1.checked; 
            alert("Desactiva la tabla primero."); 
            return; 
        }
        if (client) {
            const comando = e.target.checked ? 'ENCENDER_C1' : 'APAGAR_C1';
            client.publish('emqx/comando', comando);
        }
    });

    switchC2.addEventListener('change', (e) => {
        if (tablaC2Activa) { 
            e.preventDefault(); 
            switchC2.checked = !switchC2.checked; 
            alert("Desactiva la tabla primero."); 
            return; 
        }
        if (client) {
            const comando = e.target.checked ? 'ENCENDER_C2' : 'APAGAR_C2';
            client.publish('emqx/comando', comando);
        }
    });

    // --- 5. LÓGICA DE LA TABLA AUTOMÁTICA ---
    btnTablaC1.addEventListener('click', () => {
        if (tablaC1Activa) {
            tablaC1Activa = false;
            clearTimeout(timeoutTablaC1);
            btnTablaC1.innerText = "Activar Tabla";
            btnTablaC1.classList.replace('detener', 'activar');
            if (client) client.publish('emqx/comando', 'APAGAR_C1');
            switchC1.checked = false;
        } else {
            const filas = document.querySelectorAll('#tablaC1 tbody tr');
            if (filas.length === 0) return alert("La tabla está vacía.");
            
            tablaC1Activa = true;
            btnTablaC1.innerText = "Detener Tabla";
            btnTablaC1.classList.replace('activar', 'detener');
            ejecutarPasoC1(0); 
        }
    });

    btnTablaC2.addEventListener('click', () => {
        if (tablaC2Activa) {
            tablaC2Activa = false;
            clearTimeout(timeoutTablaC2);
            btnTablaC2.innerText = "Activar Tabla";
            btnTablaC2.classList.replace('detener', 'activar');
            if (client) client.publish('emqx/comando', 'APAGAR_C2');
            switchC2.checked = false;
        } else {
            const filas = document.querySelectorAll('#tablaC2 tbody tr');
            if (filas.length === 0) return alert("La tabla está vacía.");
            
            tablaC2Activa = true;
            btnTablaC2.innerText = "Detener Tabla";
            btnTablaC2.classList.replace('activar', 'detener');
            ejecutarPasoC2(0);
        }
    });

    function ejecutarPasoC1(indice) {
        if (!tablaC1Activa) return;
        const filas = document.querySelectorAll('#tablaC1 tbody tr');
        
        if (indice >= filas.length) {
            btnTablaC1.click(); 
            return;
        }

        const fila = filas[indice];
        const tiempo = parseInt(fila.querySelector('.input-tiempo').value) || 0;
        const estado = fila.querySelector('.input-estado').value;

        if (estado === 'ON') {
            switchC1.checked = true;
            if (client) client.publish('emqx/comando', 'ENCENDER_C1');
        } else {
            switchC1.checked = false;
            if (client) client.publish('emqx/comando', 'APAGAR_C1');
        }

        timeoutTablaC1 = setTimeout(() => {
            ejecutarPasoC1(indice + 1);
        }, tiempo * 1000);
    }

    function ejecutarPasoC2(indice) {
        if (!tablaC2Activa) return;
        const filas = document.querySelectorAll('#tablaC2 tbody tr');
        
        if (indice >= filas.length) {
            btnTablaC2.click();
            return;
        }

        const fila = filas[indice];
        const tiempo = parseInt(fila.querySelector('.input-tiempo').value) || 0;
        const estado = fila.querySelector('.input-estado').value;

        if (estado === 'ON') {
            switchC2.checked = true;
            if (client) client.publish('emqx/comando', 'ENCENDER_C2');
        } else {
            switchC2.checked = false;
            if (client) client.publish('emqx/comando', 'APAGAR_C2');
        }

        timeoutTablaC2 = setTimeout(() => {
            ejecutarPasoC2(indice + 1);
        }, tiempo * 1000);
    }

    // --- 6. PROCESAMIENTO DE DATOS MQTT ---
    function procesarMensaje(texto) {
        const partes = texto.split(';');
        let v = 0, i = 0, p = 0;

        partes.forEach(parte => {
            const [clave, valor] = parte.split(':');
            if (clave && valor) {
                const numValor = parseFloat(valor.trim()); 
                const valorSeguro = isNaN(numValor) ? 0 : numValor;

                if (clave.includes('vol')) v = valorSeguro;
                if (clave.includes('cur')) i = valorSeguro;
                if (clave.includes('pot')) p = valorSeguro;
            }
        });

        bufferVoltaje.push(v);
        bufferCorriente.push(i);
        bufferPotencia.push(p);
    }

    // --- 7. TEMPORIZADOR: GRAFICAR CADA 2 SEGUNDOS ---
    setInterval(() => {
        if (switchC1.checked || switchC2.checked) {
            tiempoGlobal += 2; 

            if (bufferVoltaje.length === 0) { bufferVoltaje.push(0); }
            if (bufferCorriente.length === 0) { bufferCorriente.push(0); }
            if (bufferPotencia.length === 0) { bufferPotencia.push(0); }

            let vGraficar, iGraficar, pGraficar;

            if (tiempoGlobal <= 16) {
                vGraficar = bufferVoltaje[bufferVoltaje.length - 1];
                iGraficar = bufferCorriente[bufferCorriente.length - 1];
                pGraficar = bufferPotencia[bufferPotencia.length - 1];
            } else {
                if (bufferVoltaje.length >= 5) {
                    const ultimos5V = bufferVoltaje.slice(-5);
                    const ultimos5I = bufferCorriente.slice(-5);
                    const ultimos5P = bufferPotencia.slice(-5);

                    vGraficar = ultimos5V.reduce((a, b) => a + b, 0) / 5;
                    iGraficar = ultimos5I.reduce((a, b) => a + b, 0) / 5;
                    pGraficar = ultimos5P.reduce((a, b) => a + b, 0) / 5;
                    
                    bufferVoltaje.splice(0, 5);
                    bufferCorriente.splice(0, 5);
                    bufferPotencia.splice(0, 5);
                } else {
                    return; 
                }
            }

            if (switchC1.checked) {
                chartVoltajeC1.data.labels.push(tiempoGlobal); chartVoltajeC1.data.datasets[0].data.push(vGraficar); chartVoltajeC1.update();
                chartCorrienteC1.data.labels.push(tiempoGlobal); chartCorrienteC1.data.datasets[0].data.push(iGraficar); chartCorrienteC1.update();
                chartPotenciaC1.data.labels.push(tiempoGlobal); chartPotenciaC1.data.datasets[0].data.push(pGraficar); chartPotenciaC1.update();
            }

            if (switchC2.checked) {
                chartVoltajeC2.data.labels.push(tiempoGlobal); chartVoltajeC2.data.datasets[0].data.push(vGraficar); chartVoltajeC2.update();
                chartCorrienteC2.data.labels.push(tiempoGlobal); chartCorrienteC2.data.datasets[0].data.push(iGraficar); chartCorrienteC2.update();
                chartPotenciaC2.data.labels.push(tiempoGlobal); chartPotenciaC2.data.datasets[0].data.push(pGraficar); chartPotenciaC2.update();
            }
        }
    }, 2000); 

    // --- 8. LÓGICA DE ALTERNANCIA (CORREGIDA) ---
    document.querySelectorAll('.sequence-table').forEach(tabla => {
        tabla.addEventListener('change', (e) => {
            if (e.target.classList.contains('input-estado')) {
                const filaCambiada = e.target.closest('tr');
                const tbody = filaCambiada.closest('tbody');
                const index = Array.from(tbody.children).indexOf(filaCambiada);

                if (index === 0) {
                    const estadoBase = e.target.value;
                    const filas = tbody.querySelectorAll('tr');
                    
                    filas.forEach((fila, i) => {
                        if (i > 0) {
                            const select = fila.querySelector('.input-estado');
                            const nuevoEstado = (i % 2 === 0) ? estadoBase : (estadoBase === 'ON' ? 'OFF' : 'ON');
                            select.innerHTML = `<option value="${nuevoEstado}">${nuevoEstado}</option>`;
                        }
                    });
                }
            }
        });
    });

    // --- 9. AGREGAR FILAS ---
    document.querySelectorAll('.btn-add-fila').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tablaId = e.currentTarget.getAttribute('data-tabla');
            const tabla = document.querySelector(`#${tablaId}`);
            const tbody = tabla.querySelector('tbody');
            
            if (tbody.querySelectorAll('tr').length >= 10) {
                alert("Límite alcanzado: Solo puedes agregar hasta 10 filas.");
                return;
            }

            const ultimaFila = tbody.lastElementChild;
            const estadoUltimaFila = ultimaFila.querySelector('.input-estado').value;
            const estadoNuevaFila = estadoUltimaFila === 'ON' ? 'OFF' : 'ON';

            const nuevaFila = document.createElement('tr');
            nuevaFila.innerHTML = `
                <td><input type="number" class="input-tiempo" min="1" placeholder="Ej. 5"></td>
                <td>
                  <select class="input-estado" disabled>
                    <option value="${estadoNuevaFila}">${estadoNuevaFila}</option>
                  </select>
                </td>
            `;
            tbody.appendChild(nuevaFila);
        });
    });

    // --- 10. GUARDAR SECUENCIA ---
    document.querySelectorAll('.btn-guardar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const canal = parseInt(e.currentTarget.getAttribute('data-canal'));
            guardarEnMemoria(canal);
        });
    });

    function guardarEnMemoria(canal) {
        const tablaId = canal === 1 ? 'tablaC1' : 'tablaC2';
        const tbody = document.querySelector(`#${tablaId} tbody`);
        const filas = tbody.querySelectorAll('tr');
        
        let secuenciaTemp = { canal: canal, datos: [] };

        filas.forEach(fila => {
            const inputTiempo = fila.querySelector('.input-tiempo');
            const selectEstado = fila.querySelector('.input-estado');
            
            if (inputTiempo && selectEstado) {
                const duracion = inputTiempo.value.trim();
                const estado = selectEstado.value;
                
                if (duracion !== '') {
                    secuenciaTemp.datos.push({ duracion: duracion + "s", estado: estado });
                }
            }
        });

        if(secuenciaTemp.datos.length > 0) {
            historialSecuencias.push(secuenciaTemp);
            alert(`Secuencia del Canal ${canal} guardada con éxito.`);
        } else {
            alert("La tabla está vacía, no hay nada que guardar.");
        }

        tbody.innerHTML = `
            <tr>
                <td><input type="number" class="input-tiempo" min="1" placeholder="Ej. 5"></td>
                <td>
                  <select class="input-estado">
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                  </select>
                </td>
            </tr>
            <tr>
                <td><input type="number" class="input-tiempo" min="1" placeholder="Ej. 10"></td>
                <td>
                  <select class="input-estado" disabled>
                    <option value="OFF">OFF</option>
                  </select>
                </td>
            </tr>
        `;
    }

    // --- 11. MODAL DE SECUENCIAS GUARDADAS ---
    btnVerSecuencias.addEventListener('click', () => {
        listaSecuencias.innerHTML = ""; 
        
        if (historialSecuencias.length === 0) {
            listaSecuencias.innerHTML = "<p>No hay secuencias guardadas en esta sesión.</p>";
        } else {
            historialSecuencias.forEach((seq, index) => {
                let texto = `<strong>Secuencia ${index + 1} (Canal ${seq.canal}):</strong><br>`;
                seq.datos.forEach(d => { texto += `Duración: ${d.duracion} | Estado: ${d.estado}<br>`; });
                
                const divSeq = document.createElement('div');
                divSeq.innerHTML = `${texto}<hr>`;
                
                const btnDescargar = document.createElement('button');
                btnDescargar.innerText = "Descargar CSV";
                btnDescargar.className = "btn-descargar";
                btnDescargar.onclick = () => descargarCSV(seq, index);
                
                divSeq.appendChild(btnDescargar);
                listaSecuencias.appendChild(divSeq);
            });
        }
        modal.style.display = "block";
    });

    function descargarCSV(secuencia, index) {
        let datosCsv = "Duracion,Estado\n"; 
        secuencia.datos.forEach(d => {
            datosCsv += `${d.duracion},${d.estado}\n`;
        });

        const blob = new Blob([datosCsv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Secuencia_${index + 1}_Canal_${secuencia.canal}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    closeModal.addEventListener('click', () => modal.style.display = "none");
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = "none"; });

    conectarMQTT();
});