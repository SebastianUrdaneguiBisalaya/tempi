import type { Messages } from '../types';
import type { en } from './en';

export const es = {
	common: {
		actions: {
			cancel: 'Cancelar',
			close: 'Cerrar',
			confirm: 'Confirmar',
			create: 'Crear',
			delete: 'Eliminar',
			edit: 'Editar',
			save: 'Guardar',
		},
		calendar: {
			allDay: {
				collapse: 'Mostrar menos eventos de todo el día',
				expand: 'Mostrar todos los eventos de todo el día',
				events: 'Todo el día: {{titles}}',
				more: '+{{count}} más',
			},
			grid: 'Agenda',
			month: {
				more: '+{{count}} más',
				week: 'Semana {{number}}',
				weekNumber: 'Semana',
			},
		},
		onboarding: {
			actions: {
				back: 'Atrás',
				finish: 'Empezar',
				next: 'Continuar',
				skip: 'Omitir',
			},
			avatar: {
				change: 'Cambiar foto',
				choose: 'Elegir foto',
				description: 'Opcional. Se queda en este dispositivo.',
				invalid: 'No se puede usar esta imagen. Prueba con otra.',
				remove: 'Quitar foto',
				title: 'Añade una foto de perfil',
			},
			language: {
				description: 'Puedes cambiarlo luego en la configuración.',
				title: 'Elige tu idioma',
			},
			location: {
				country: 'País',
				countryEmpty: 'No se encontraron países.',
				countryPlaceholder: 'Selecciona un país',
				countrySearch: 'Buscar países…',
				description: 'Tu zona horaria mantiene cada evento a la hora correcta.',
				timeZone: 'Zona horaria',
				title: '¿Dónde estás?',
			},
			name: {
				description: 'Personaliza tu calendario.',
				firstName: 'Nombre',
				lastName: 'Apellido',
				title: '¿Cómo te llamas?',
			},
			progress: 'Paso {{current}} de {{total}}',
			theme: {
				description: 'Puedes cambiarlo luego en la configuración.',
				options: {
					dark: 'Oscuro',
					light: 'Claro',
					system: 'Sistema',
				},
				systemDescription: 'Sigue a tu dispositivo.',
				title: 'Elige un tema',
			},
			title: 'Te damos la bienvenida a Tempi',
		},
		shell: {
			header: {
				label: 'Navegación del calendario',
				next: {
					day: 'Día siguiente',
					month: 'Mes siguiente',
					week: 'Semana siguiente',
				},
				previous: {
					day: 'Día anterior',
					month: 'Mes anterior',
					week: 'Semana anterior',
				},
				today: 'Hoy',
			},
			panel: {
				label: 'Detalles',
				open: 'Abrir detalles',
				search: 'Buscar',
			},
			sidebar: {
				datePicker: 'Ir a una fecha',
				close: 'Cerrar barra lateral',
				label: 'Barra lateral',
				toggle: 'Mostrar u ocultar barra lateral',
			},
			views: {
				day: 'Día',
				label: 'Vista',
				month: 'Mes',
				week: 'Semana',
			},
		},
		toasts: {
			onboardingCompleted: 'Todo listo.',
			settingsSaved: 'Configuración guardada.',
		},
	},
	errors: {
		avatar: {
			fileName: 'No se encuentra esta foto.',
			tooLarge: 'Esta foto es demasiado grande.',
		},
		calendar: {
			color: 'Elige un color válido.',
			defaultNotDeletable: 'El calendario predeterminado no se puede eliminar.',
			defaultRequired: 'Primero marca otro calendario como predeterminado.',
			notFound: 'Este calendario ya no existe.',
		},
		event: {
			endBeforeStart: 'El fin debe ser posterior al inicio.',
			notFound: 'Este evento ya no existe.',
			rrule: 'La regla de repetición no es válida.',
		},
		profile: {
			country: 'Elige un país válido.',
		},
		range: {
			endBeforeStart: 'El fin del rango debe ser posterior a su inicio.',
		},
		system: {
			unexpected: 'Algo salió mal. Vuelve a intentarlo.',
		},
		validation: {
			custom: 'Este valor no es válido.',
			instant: 'Introduce una fecha y hora válidas.',
			integer: 'Introduce un número entero.',
			invalid_element: 'Uno de los elementos no es válido.',
			invalid_format: 'El formato no es válido.',
			invalid_key: 'Una de las claves no es válida.',
			invalid_type: 'Este valor tiene un tipo incorrecto.',
			invalid_union: 'Este valor no es válido.',
			invalid_value: 'Elige una de las opciones disponibles.',
			max: 'Debe ser {{maximum}} o menos.',
			min: 'Debe ser {{minimum}} o más.',
			not_multiple_of: 'Debe ser múltiplo de {{divisor}}.',
			required: 'Este campo es obligatorio.',
			timeZone: 'Elige una zona horaria válida.',
			too_big: 'Debe ser {{maximum}} o menos.',
			too_small: 'Debe ser {{minimum}} o más.',
			unrecognized_keys: 'Hay campos desconocidos.',
			url: 'Introduce un enlace http(s) válido.',
		},
	},
} as const satisfies Messages<typeof en>;
